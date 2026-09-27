# Platform access: one Turnfin, many areas

Turnfin is the staff platform for every area of the leisure centre: the swim
school (Aquatics), Docs, Refunds, Training, HR and performance, and the Rota.
Legend remains the booking and billing system, so Bookings is not a module.

Some information must never reach certain staff (HR and performance above all),
and some information from a module must reach people who cannot use the module
itself: a lifeguard completes a training and sees their own certificates
without ever seeing how trainings are managed or anyone else's records. This
document is the model that makes both true. Owner decisions, September 2026.

## The model

**Workspaces are presentation, not security.** The portal, the module switcher,
role homes such as the Reception Portal and the My hub show people what they
can use. Security comes from four things underneath:

1. **Capabilities.** Named permissions, declared in the catalogue
   (`src/lib/staff/permissions.ts`). Some are **restricted** (HR and performance):
   administrators never inherit them.
2. **Assignments.** A role says *what* someone may do; the assignment says
   *where* or *over whom*. Every person has a **primary role**, which applies
   everywhere, and may have **additional roles** (`RoleAssignment`), each scoped to:
   - everywhere in the organisation;
   - one **site** (a `Club`) and the people based there;
   - one **department** and its members;
   - the holder's own **reports** (direct and indirect, through `User.managerId`).
3. **Surfaces.** A module is one area of data with several audiences, and each
   audience gets its own surface with its own field list. Aquatics has an office
   (swim school management), a desk (reception), a deck (instructors), a parents
   surface (external, through the parent app) and My (the staff member's own
   records). Self-service is never a grant: My surfaces serve a person's own
   records without any capability.
4. **Data classification.** Sensitive fields are tagged (`medical`, `contact`,
   `emergency`, `staff-note`, `hr-restricted`) and each surface declares which
   classes it may see.

### Tiers

| Tier | How | Holds |
| --- | --- | --- |
| Staff | Roles they are given | Exactly what their roles grant, where they apply |
| Administrator | `staff.manage` + `roles.manage` | Every current and future capability except restricted ones |
| Superadmin | `User.isSuperadmin` (a flag) | Everything in the organisation, restricted included |

Only a superadmin makes another superadmin, and the last active superadmin
cannot be removed or deactivated. Only a superadmin creates, edits or assigns a
role holding a restricted capability (`StaffRole.restricted`). Role previews
(development only) drop the superadmin flag and every additional role, so they
can only remove access. The first superadmin is designated by an operator:

    npx tsx scripts/grant-superadmin.ts --email owner@example.com --confirm

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
  withdrawn). Training writes them, the Rota reads them, the My hub shows them.

Staff › a person shows their profile, roles (main and additional, with where
each applies) and qualifications. Staff › Organisation holds departments and
qualification types. Docs uses the same sites and departments: its facility and
team groups for them are mirrored from the platform (`source='platform'`) and
membership follows the Staff profile; older Docs-only groups remain.

## How code asks

**Flat checks** (`can`, `canSee`, `requirePermission`, `screenPage` in
`src/lib/authz.ts` and `src/lib/page-guards.ts`) answer "may this person do
this here?" for screens and actions. The session's flat permissions are the
primary role plus additional roles that apply everywhere or at the **current
site**. Department and line-manager scopes never widen them.

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

## Rules

- Never check a role name. Ask for a capability, and for records, a resource.
- Never treat navigation, tiles, presets or workspaces as security.
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
fictional LeisureWorld (a superadmin, a site manager with a site-limited duty
role, an aquatics lead who records qualifications for Aquatics, instructors and
reception). It never reads real database settings. Accounts and the sandbox
password are listed in `scripts/sandbox.mts`.
