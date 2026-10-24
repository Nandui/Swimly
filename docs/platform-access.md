# Access: who can do what, where

How Turnfin decides what a person can open and do, as it works today. The levels each app offers, and where each applies, are listed once in [how-turnfin-works.md](how-turnfin-works.md#levels); the code rules are in [CLAUDE.md](../CLAUDE.md). Planned next: a person can hold more than one job, each a role at some sites ([architecture/jobs-and-work-layer.md](architecture/jobs-and-work-layer.md)).

Two things must both hold. Some information must never reach certain staff (HR above all). And some information must reach people who cannot use the app it lives in: a lifeguard completes a course and sees their own certificates without seeing how training is managed or anyone else's records. That is what Turnfin Me is for.

## The model

1. **Roles with levels.** A role holds one level for each app (None, then for example Use and Manage) plus at most two extras (`StaffRole.levels`, `StaffRole.extras`). Each person holds **one role** and the **sites they work at** (`User.siteIds`; none means every site).
2. **Levels become permissions.** `src/lib/staff/levels.ts` turns levels into the named permissions that pages, menus and actions check. Code never asks for a level or a role name.
3. **Where a level applies.** Each app's description says whether its levels apply at the person's sites, over the people they manage (HR "Their team", through `User.managerId`), or everywhere ([how-turnfin-works.md](how-turnfin-works.md#levels)).
4. **The working site.** The person works at one of their sites at a time (`getCurrentClub`, `src/lib/clubs/current.ts`): their chosen site if valid, else their main site, else their first. The site picker and `switchClub` offer only their sites.
5. **Restricted permissions** (HR) are never given to administrators; only a superadmin gives a role that holds them (`StaffRole.restricted`).

**Home, menus, cards and hiding are presentation, never security.** Every page and action checks its permission again.

### Tiers

| Tier | How | Holds |
| --- | --- | --- |
| Staff | their role | what the role's levels give, where they apply |
| Administrator | Admin: Manage (`staff.manage` + `roles.manage`) | Manage in every app except HR, now and for future apps |
| Superadmin | `User.isSuperadmin`, a flag, never a permission | everything in the organisation, HR included |

Only a superadmin makes another, and the last active superadmin cannot be removed or deactivated. The first is designated by an operator (`npx tsx scripts/grant-superadmin.ts --email owner@example.com --confirm`); LeisureWorld's owner was designated by the migration `20261010120000_first_superadmin`.

**Role previews** ("View as", the eye button in every frame's tools bar, development only, for anyone holding `roles.manage` or a superadmin) rebuild the session from the previewed role's levels at the viewer's own sites and drop the superadmin flag, so they can only remove access.

## People and places

One person record and one organisation chart, which every app reads through `src/lib/directory.ts`:

- `Organisation`: the operator (LeisureWorld). Every new table carries `orgId`, so Turnfin can be sold to other operators without a rewrite.
- Sites are `Club` rows, each with `orgId`.
- `Department` (optionally tied to a site) and `UserDepartment` (with a main one).
- `User.managerId` (the reporting line; loops are refused), job title, start date and main site.
- `QualificationType` and `Qualification` (issued, expires, verified by, withdrawn): Training writes them, Rota reads them, Turnfin Me shows each person theirs.

Admin › Staff › a person shows their profile, role, sites and qualifications. Docs mirrors the platform's sites and departments as its facility and team groups (`source='platform'`), and every role is a Docs team.

## How code asks

**Flat checks** (`can`, `canSee`, `requirePermission`, `screenPage` in `src/lib/authz.ts` and `src/lib/page-guards.ts`) answer "may this person do this here?" for screens and actions. The session's flat permissions are what the role gives **at the site they are working in**. Their other sites and their team never widen them; only the policy engine reads those.

**The policy engine** (`src/lib/policy`) answers "may this person do this to *these* records?". Any code that reads or changes other people's records (training, qualifications, HR notes, reading reports) must use it:

- `requireCapFor(cap, resource)` and `mayFor(cap, resource)`: one person or record, where a resource is `{ subjectUserId?, siteId?, orgId? }`.
- `subjectsFor(cap)`: whose records a permission reaches, as user ids to filter by, in this database or another (Docs, HR).
- `sitesFor(cap)`: which sites it reaches, for site-bound data.
- `logAccess(...)`: the read log for restricted data.

Each grant reaches everywhere, one site, or the person's reports. Another organisation's data is never reachable. The engine is pure and matrix-tested (`src/lib/policy/policy.test.ts`).

**Step-up.** Restricted permissions need a sign-in with Google or a password in the last 15 minutes; a PIN switch never counts (`requireFreshSession`, `/confirm-password`, which sends a Google session back through Google).

## Why it is built this way

- **Roles are data; the permission catalogue is code.** `src/lib/staff/permissions.ts` lists every permission, because a permission exists only when a screen or action asks for one. There is no Permission table, which would be a second copy kept in step by hand. A stored key no longer in the catalogue is ignored rather than fatal, so removing a permission is safe.
- **Administrators always have full access.** Holding both `staff.manage` and `roles.manage` makes an administrator; `expandPermissions` and `visibleScreens` resolve the whole current catalogue, so administrators get new permissions without a data change (restricted ones excepted).
- **Someone can always get back in.** `staff.manage` and `roles.manage` are load-bearing: lose either across every active account and the way back is a database console, because `prisma/seed.ts` declines once an admin exists. `src/lib/staff/keyholders.ts` refuses any change that would leave nobody holding one, working out what the world would look like afterwards under row locks, not by counting role names. It is not in a `"use server"` file, because every export of one is an endpoint the browser can call.
- **Nothing refers to a role by name**: not the code, the menus or the seed. That is what lets an organisation rename or delete every role Turnfin shipped with.
- **A screen is a menu entry opened by one permission** (`src/lib/staff/screens.ts`). Every page opens with `screenPage(screen, permission?)` and is "not found" for anyone without it; a link into another screen asks `canSee` first. Account is always there.
- **The same rule is guarded in three places**, because they answer different questions: the menu hides what you cannot reach, the page hides the button (`src/lib/page-guards.ts`), and the action refuses the call. Only the action is security.
- **The session is re-read from the database on every request**, so deactivating someone, changing their role or removing a permission from a shared role takes effect at once rather than at token expiry. Only the person's id is in the token.
- **Sign-in failure is one sentence for every reason** (wrong password, unknown address, deactivated account), so the form cannot be used to find out who has an account.
- **`DEV_AUTH_BYPASS=1`** signs in as the first active admin in the database, only when `NODE_ENV` is not production. It uses a real account, so audit rows point at someone who exists and checks behave as in production.

## Turnfin and Turnfin Me

Turnfin is the job, on registered work computers, and has no personal pages: `/` opens the person's Home. A person's own records (training, required reading, qualifications, shifts, what HR shared, their details) are in **Turnfin Me** (`apps/me`), a connected product that only talks to the staff API. The self-service reads (`*/mine.ts`) and writes (`*/self.ts`) in each module serve that API only. Signing in to Turnfin away from a registered device needs `work.anywhere` when `WORK_DEVICE_REQUIRED` is on. See [staff-app.md](staff-app.md).

## Signing in

Email and password, and **Sign in with Google** where it is set up (`src/lib/google-sign-in.ts`).

- **Passwords** work for every active account that has one. Admin › Staff can add people without a password when Google is set up; "Set a new password" gives any account one. The unlinked `/sign-in/developer` page shows the password form alone.
- **Google matching.** The Google id (`User.googleId`) is matched first, then the Google-verified email. An unverified email is never used.
- **New accounts from Google.** A first sign-in with a Workspace account in a work domain (`hd` and address both in `AUTH_GOOGLE_DOMAINS`, default `leisureworldcork.com`) makes an active account with **no role** and an audit row. With no role it opens nothing: the sign-in page says to ask a manager, and Admin › Staff lists it under **Waiting for a role**. Personal Google accounts and other domains get no account.
- **Kept fresh.** Each Google sign-in takes the name and picture (`User.avatarUrl`, https only) from Google, and a changed address when no other account has it, with audit rows. `User.lastSignInAt` is set on every sign-in, by any route.
- **Password at every Google sign-in.** Work computers are shared, so Google is asked to check the password every time (`max_age=0`). A missing or old `auth_time` is logged, not refused. Turnfin cannot stop Chrome saving passwords: that is a Google Admin console setting.
- **Deactivated** accounts stay shut; Google never reopens one. The work-computer rule applies as for a password.
- **Setting it up.** Google is on only where `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set: a Google Cloud OAuth web client with the redirect URI `https://<the app's address>/api/auth/callback/google` (for LeisureWorld, `https://turnfin.app/api/auth/callback/google`). Elsewhere the button is hidden. Previews have a new address every time, which Google cannot list, so set the two variables for Production only.

## Shared devices

Reception computers and poolside tablets are used by whoever is on shift. Someone who manages staff registers a browser as a shared device (Staff › Work devices); it gets a signed cookie (`src/lib/devices/shared-device.ts`) and can be revoked centrally.

- **Quick switch** (`/switch`): people tap their name and enter a personal PIN (set on Account after a recent sign-in). Only people who have signed in on that device and have a PIN are listed. Five wrong PINs lock the PIN until the person signs in again; a sign-in clears the lock and adds them to the device's list.
- **Idle sign-out**: shared-device sessions return to the switch screen after 5 idle minutes and never last more than 12 hours.
- The session records how and when the person proved who they are (`authMethod`, `authAt`, `sharedDevice`); it never carries permissions.

## Who sees which swimmer fields

The swim school serves several audiences over one set of records. `src/modules/activities/shared/classification.ts` tags swimmer fields (`medical`, `contact`, `emergency`, `staff-note`) and decides who receives each:

| Screens | Who | Medical notes |
| --- | --- | --- |
| Office (courses, programmes, curriculum) | swim school managers | yes |
| Desk (swimmers, enrolment, follow-up) | reception | yes |
| Pool deck (`/instructor`) | instructors | only for swimmers in a class they teach or cover that day |
| Parent app (parent API) | linked guardians | never; they propose corrections instead |
| Anyone else | roles with no swim school level | never: they read no swimmer data |

A withheld note becomes a `hasMedicalNotes` flag, shown as a "Medical" tag, so the deck still knows to ask. Loaders pass where they are used (`getRegister(…, "deck")`). On the pool deck, `/instructor/swimmers` finds any swimmer with a current place at the working site: name, age and class only. Parents' corrections are applied or declined at `/students/parent-changes` ([parent-app.md](parent-app.md)).

## Apps with their own access rules

- **Training** applies at a person's sites; each page scopes records with the policy engine. Completing your own training happens in Turnfin Me ([training.md](training.md)).
- **Rota** is site-bound: its permissions resolve with `sitesFor` and `requireCapFor` with a `siteId` ([rota.md](rota.md)).
- **HR** is restricted: its own database (`HR_DATABASE_URL`), permissions administrators never inherit, step-up for every read and write, a read log (`access_events`) and a superadmin-only subject export. The HR database holds ids only; access is decided in the main database by the policy engine ([hr.md](hr.md)).

## Rules

- Never check a role name. Ask for a permission, and for records, a resource.
- Never treat navigation, Home or cards as security.
- Never copy permissions into an app's own database; read identity through the directory and decide with the engine.
- Administrators never inherit restricted permissions.
- Self-service code serves only the signed-in person's own records, through the staff API.
- No raw rows reach the browser: each screen and API maps records through an allowlist, with tests.

## The sandbox

`npm run sandbox` runs Turnfin on throwaway in-memory databases with a fictional LeisureWorld and six roles, one person each:

| Person | Role | Home page |
| --- | --- | --- |
| Alex (superadmin) | Admin | Management |
| Maya (works at Churchfield) | Duty manager | Duty desk |
| Liam | Swim school manager (HR for his team) | Swim school office |
| Ava | Instructor | Pool deck |
| Noah | Receptionist | Front of House |
| Riley | Lifeguard | Poolside |

It also seeds synthetic swimmers, today's classes at two sites, a parent's pending correction, training waiting for sign-off and overdue, HR notes and a shared review, and a rota with an expired qualification, an open shift and a double-booking (`scripts/sandbox-seed.ts`). It never reads real database settings. The sandbox password and PIN are in `scripts/sandbox.mts`.
