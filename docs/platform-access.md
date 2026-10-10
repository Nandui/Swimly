# Platform access: one Turnfin, many areas

Turnfin is the staff platform for every area of the leisure centre: the swim
school (Aquatics), Docs, Refunds, Training, HR and the Rota.
Legend remains the booking and billing system, so Bookings is not a module.

Some information must never reach certain staff (HR above all),
and some information from a module must reach people who cannot use the module
itself: a lifeguard completes a training and sees their own certificates
without ever seeing how trainings are managed or anyone else's records. This
document is the model that makes both true. Owner decisions, September 2026.

## The model

*Simplified 28 September 2026: see [how-turnfin-works.md](how-turnfin-works.md).*

1. **Modules.** Swim school, Pool deck, Refunds, Docs, Training, Rota, HR and Admin, each
   described once in `src/modules/registry.ts`.
2. **Roles with levels.** A role holds one level for each module (None, then for
   example Use and Manage) plus at most a couple of extras. Each person holds
   **one role** and the **sites they work at** (`User.siteIds`; none means every
   site). The working site (`getCurrentClub`, `src/lib/clubs/current.ts`) is one of
   those sites: without a valid choice it defaults to their primary site, then their
   first site, and the site picker and `switchClub` offer only their sites.
3. **Levels become permissions.** `src/lib/staff/levels.ts` translates levels
   into the named permissions (capabilities) that pages, menus and actions
   check, so code never asks for a level or a role name. Some permissions are
   **restricted** (HR): administrators never get them, and only a superadmin
   gives HR.
4. **Where a level applies.** Swim school, Pool deck, Tasks, Training and Rota apply at the
   person's sites; HR "Their team" reaches only the people they manage (through
   `User.managerId`); everything else applies everywhere. The policy engine
   receives these as grants.
5. **Data classification.** Sensitive fields are tagged (`medical`, `contact`,
   `emergency`, `staff-note`, `hr-restricted`) and each surface declares which
   classes it may see.

**Home pages are presentation, not security.** A role's home page shows its
modules; every page and action checks its permission again.

### Tiers

| Tier | How | Holds |
| --- | --- | --- |
| Staff | Roles they are given | Exactly what their roles grant, where they apply |
| Administrator | `staff.manage` + `roles.manage` | Every current and future capability except restricted ones |
| Superadmin | `User.isSuperadmin` (a flag) | Everything in the organisation, restricted included |

Admin: Manage is the administrator: Manage in every module except HR. Only a
superadmin makes another superadmin, and the last active superadmin cannot be
removed or deactivated. Only a superadmin creates, edits or gives a role holding
HR (`StaffRole.restricted`). Role previews (development only; "View as", the
eye button in every frame's tools bar, for anyone holding `roles.manage` or a
superadmin) rebuild the session from the previewed role's levels at the
viewer's own sites, as `sessionUserFor` does for a real holder, and drop the
superadmin flag, so they can only remove access. The first superadmin is designated by an operator:

    npx tsx scripts/grant-superadmin.ts --email owner@example.com --confirm

LeisureWorld's first superadmin, the owner, was designated by the migration
`20261010120000_first_superadmin` (1 October 2026), which does nothing once any
active superadmin exists.

## The People core

One person record and one organisation chart that every module reads
(migration `20260928120000_people_core`, additive):

- `Organisation`: the operator (LeisureWorld). Every new table carries `orgId`,
  so Turnfin can later be sold to other operators without a rewrite.
- Sites are the existing `Club` rows, now with `orgId`.
- `Department` (optionally tied to a site) and `UserDepartment` (with a main one).
- `User.managerId` (the reporting line; loops are refused), job title, start
  date and main site.
- `QualificationType` and `Qualification` (issued, expires, verified by,
  withdrawn). Training writes them, the Rota reads them, Turnfin Me shows each person theirs.

Staff › a person shows their profile, their role and the sites they work at,
and their qualifications. Staff › Organisation holds departments and
qualification types. Docs uses the same sites and departments: its facility and
team groups for them are mirrored from the platform (`source='platform'`) and
membership follows the Staff profile; older Docs-only groups remain.

## How code asks

**Flat checks** (`can`, `canSee`, `requirePermission`, `screenPage` in
`src/lib/authz.ts` and `src/lib/page-guards.ts`) answer "may this person do
this here?" for screens and actions. The session's flat permissions are
what the person's role gives **at the site they are working in**. Their other
sites and their team (HR "Their team") never widen them; only the policy engine
reads those.

**The policy engine** (`src/lib/policy`) answers "may this person do this to
*these* records?". Any code that reads or changes other people's records
(training records, qualifications, HR notes, reading reports) must use it:

- `requireCapFor(cap, resource)` / `mayFor(cap, resource)`: one person or
  record, where a resource is `{ subjectUserId?, siteId?, departmentId?, orgId? }`.
- `subjectsFor(cap)`: whose records a capability reaches, as user ids to filter
  a query by, in this database or another (Docs, HR).
- `sitesFor(cap)`: which sites it reaches, for site-bound data.
- `logAccess(...)`: read-audit for restricted data.

Restricted capabilities also need a fresh password check: a session that
switched in with a PIN on a shared device, or whose password was confirmed more
than 15 minutes ago, must confirm the password again (step-up).

The engine is pure and matrix-tested (`src/lib/policy/policy.test.ts`): staff,
line manager, department lead, site manager, multi-site manager, administrator
and superadmin, against self, a report, a report's report, another department,
another site and another organisation.

## Turnfin Work and Turnfin Me

*Replaces the My hub (owner decision, 27 September 2026).*

Work is for the job on registered work PCs; a person's own records (training,
required reading, qualifications, shifts, what HR shared, their details) live in
**Turnfin Me**, a separate phone app (`apps/me`) that only talks to the staff API.
Work has no personal pages: `/` opens the role's home. Signing in to Work away from a
registered device needs `work.anywhere` once `WORK_DEVICE_REQUIRED` is on. The
self-service reads (`*/mine.ts`) and writes (`*/self.ts`) serve the staff API only.
See docs/staff-app.md.

## Shared devices

Reception computers and poolside tablets are used by whoever is on shift. Someone who
manages staff registers a browser as a shared device (Staff › Shared devices); it gets
a signed cookie (`src/lib/devices/shared-device.ts`) and can be revoked centrally.

- **Quick switch** (`/switch`): people tap their name and enter a personal PIN (set on
  Account with their password). Only people who have signed in on that device with
  their password and have a PIN are listed. Five wrong PINs lock the PIN until the
  person signs in with their password.
- **Idle sign-out**: shared-device sessions return to the switch screen after 5 idle
  minutes, and never last more than 12 hours.
- **Step-up**: a PIN session never counts as a fresh password. Restricted records
  (HR, performance) send the person to confirm their password first
  (`requireFreshSession`, `/confirm-password`), valid for 15 minutes.
- The session records how and when the person proved who they are
  (`authMethod`, `authAt`, `sharedDevice`); it never carries permissions.

## Aquatics surfaces

Aquatics is the reference for a module with several audiences over one set of
records. `src/modules/activities/shared/classification.ts` tags swimmer fields by class
(`medical`, `contact`, `emergency`, `staff-note`) and decides who receives each:

| Surface | Who | Medical notes |
| --- | --- | --- |
| Office (courses, programmes, curriculum) | Swim school managers | Yes |
| Desk (swimmers, enrolment, follow-up) | Reception | Yes |
| Deck (`/instructor`) | Instructors | Only for swimmers in a class they teach or cover that day |
| Parents (parent API) | Linked guardians | Never; they propose corrections instead |
| Anyone else | Docs-only, Refunds-only, read-only roles | Never; roles with no Aquatics screen read no swimmer data |

Withheld notes become a `hasMedicalNotes` flag, shown as a "Medical" tag, so the
deck still knows to ask. Loaders pass their surface (`getRegister(…, "deck")`);
the class roster only carries the flag. Instructors can look up any swimmer with
a current place at their working site at `/instructor/swimmers` — name, age and
class only, never contacts or staff notes.

Parents propose contact, emergency and medical corrections through the parent API;
reception applies or declines them at `/students/parent-changes`. See
docs/parent-app.md.

## Training

Training (docs/training.md) is people-scoped. Its levels (Trainer, Manage)
apply at the sites a person works at, so a trainer signs off for the people at
their sites; each page scopes records with the policy engine. A course can be
given to everyone on a role at once.
Completing your own training needs no capability and happens in Turnfin Me.

## Rota

The Rota (docs/rota.md) is site-bound: `rota.view`, `rota.plan` and `rota.manage` (Run)
resolve with `sitesFor` and `requireCapFor` with a `siteId`, so a duty manager who works at
one site runs that site only. Plan also needs the department: a supervisor plans the days
ahead for the departments they belong to. It warns about expired qualifications and
double-bookings but never blocks. Everyone sees their own shared days in Turnfin Me.

## HR

HR (docs/hr.md) is the restricted module: its own database (`HR_DATABASE_URL`),
restricted capabilities that administrators never inherit, a recent password for
every read and write (`requireFreshSession`, `requireRecentPassword`), a read log
(`access_events`) and a superadmin-only subject export. The HR database holds ids
only; access is decided in the main database by the policy engine.

## Rules

- Never check a role name. Ask for a capability, and for records, a resource.
- Never treat navigation, home pages or cards as security.
- Never copy permissions into a module's own database; read identity through
  the directory and decide with the engine.
- Administrators never inherit restricted capabilities.
- A module's My surface serves only the signed-in person's own records and
  never queries another module's tables.
- No raw rows reach the browser: each surface maps records through an allowlist,
  with tests.
- Schema changes stay additive: development and production share a database.

## Local sandbox

`npm run sandbox` runs the whole app on throwaway in-memory databases with a
fictional LeisureWorld and the six roles from How Turnfin works, one each:

| Person | Role | Home page |
| --- | --- | --- |
| Alex (superadmin) | Admin | Management |
| Maya (works at Churchfield) | Duty manager | Duty desk |
| Liam | Swim school manager (HR for his team) | Swim school office |
| Ava | Instructor | Pool deck |
| Noah | Receptionist | Front of House |
| Riley | Lifeguard | Poolside |

It also seeds synthetic swimmers, classes on today's weekday at two sites, a
parent's pending correction, training (Riley waits for sign-off, Ava has overdue
and open courses), HR notes and a shared review for Ava, and a rota whose shifts
show an expired qualification, an open shift and a double-booking
(`scripts/sandbox-seed.ts`). It never reads real database settings. The sandbox
password and PIN are in `scripts/sandbox.mts`.
