# Turnfin Courses: the split

Turnfin Courses is the first app to leave Turnfin for its own subdomain, `courses.turnfin.app` ([D34](decisions.md)). This doc says what it is, what it shares, how it is built and the order the work happens in. It is the one place for these facts; the other docs link here.

## What it is

One app for everything the centres teach and sell places on:

| Part | Was, in Turnfin | Users |
| --- | --- | --- |
| Swim classes | Classes (`src/modules/activities`): swimmers, classes, places, assessments, programmes, cancellations, failed payments | reception, swim school managers |
| Pool deck | Pool deck (same module): registers, competencies, assessments | instructors, on tablets |
| Short courses | part of Classes, on its own tables | reception, instructors |
| Academy courses | Academy (`src/modules/academy`): lifeguard and swim teacher courses for the public | tutors, managers |
| Reports | Analytics (same module) | swim school managers |
| The parent app's API and the Academy booking site's API | `/api/parent/v1`, `/api/parent-admin/v1`, `/api/academy/v1` | the two connected products |

It is written again from scratch. Turnfin's rules for apps (the six-part contract, the frame, the five-page limit, Turnfin Sheet) do not bind it. Staff keep their Turnfin accounts and roles. What still binds it is in [What does not change](#what-does-not-change).

## What it shares, and what it does not

| | Shared with Turnfin | Its own |
| --- | --- | --- |
| Repository | yes: `apps/courses` | its own `package.json`, lint, tests and `AGENTS.md` |
| Database | yes: the main database, and the tables it already has | new tables in `prisma/schema/courses.prisma`, prefixed `courses_` |
| Deploy | no | its own Vercel project, `turnfin-courses`, root `apps/courses`, like Turnfin Me and the Academy site |
| Accounts | yes: staff keep their Turnfin account, password and role | its own session cookie on `courses.turnfin.app` |
| Access | yes: the role an administrator gave the person in Turnfin | its own short list of grants, worked out from that role |
| Design | no | its own, approved from mockups before any screen is built |
| Code | nothing imported from `src/` | everything under `apps/courses/src` |

**Why its own Vercel project, when the same one was allowed.** A standalone app inside Turnfin's build would share Turnfin's root layout, theme, lint rules and sign-in cookie, and `/courses` already means swim classes there. A second root layout means moving every Turnfin route. `apps/me` and `apps/academy` already deploy from this repository as their own projects, so this is the existing pattern, and it changes nothing in Turnfin. Creating the project and the domain needs the owner's yes.

## Data

- **The tables keep their names and rows.** Courses takes over the tables in `activities.prisma`, `activities.short-courses.prisma` and `academy.prisma`. Nothing is copied. Until the switch, Turnfin's code and Courses read and write the same rows, so both can run at once.
- **One migration history.** The database has one set of migrations, `prisma/migrations`, applied by Turnfin's production build. Courses adds to it and never runs migrations itself. Database changes still only add.
- **Its own client.** Courses generates its own Prisma client from `prisma/schema` into `apps/courses/src/generated/prisma`. It queries only its own tables, and reads three of the platform's without ever writing them: `clubs` (sites), `users` (who is signing in, and names) and `staff_roles` (what their role opens). Lint refuses any other model, and any write to those three.
- **New tables** carry `orgId` and the `courses_` prefix: `courses_sessions`, `courses_sign_ins`, `courses_log` so far.

## Sign-in and access

**Staff keep their accounts and logins** (owner, 27 November 2026): instructors, receptionists, managers and administrators sign in to Courses with the Turnfin account they already have. Courses has no accounts of its own, and nobody is set up twice.

- **Who you are** is your Turnfin person record (`users`). Courses reads it and never writes it. The course tables already record staff by that id (a class's instructor, who marked a register), so nothing needs linking.
- **Sign-in is Continue with Turnfin.** Courses asks for no password. Its sign-in page has one button, which sends the browser to Turnfin (`/api/courses/pass`). Turnfin signs the person in the way it always does (password, Sign in with Google, a work device's rules) or already knows who they are, then sends the browser back with a **pass**: the person's id, good for one minute, signed with a secret only the two share (`COURSES_PASS_SECRET`), and tied to a random state Courses left in that browser. Courses checks all of that and opens its own session. Signed in to Turnfin already, there is nothing to type.
- **Its own session.** A random token stored hashed in `courses_sessions`, sent as an `HttpOnly`, `Secure`, `SameSite=Lax` cookie for `courses.turnfin.app` only. It ends after 12 hours or 30 idle minutes. Signing out of Courses ends that session only; Turnfin's sign-in is Turnfin's to end.
- **Without Turnfin beside it** (local development with `TURNFIN_URL` unset), the sign-in page asks for the Turnfin email and password itself, and five wrong passwords pause it for 15 minutes (`courses_sign_ins`). Where Continue with Turnfin is set up, that form is off.
- **On a shared work device**, switch in on Turnfin with your PIN first, then continue: the PIN screen does not yet send you back to Courses by itself.
- **What you can do** comes from the role an administrator already gave you in Turnfin (Admin › Roles), read on every request, so a change there takes effect here at once. Deactivated in Turnfin is signed out here. Code asks for a grant, never a job title:

| Grant | Opens | Given by the role's level in Turnfin |
| --- | --- | --- |
| `desk` | swimmers, places, moves, waiting lists, assessment and course bookings, failed payments | Classes: Desk |
| `manage` | programmes, classes, short course lists, prices, uploads, reports | Classes: Manage (includes `desk`) |
| `cancel` | cancelling today's sessions | Classes: Can cancel classes |
| `teach` | the pool deck for their own classes and courses | Pool deck: Teach |
| `lead` | the pool deck for any class | Pool deck: Lead (includes `teach`) |
| `tutor` | Academy courses: candidates, checks, payment, registers, results | Academy: Tutor |
| `academy` | the Academy course list and putting courses on | Academy: Manage (includes `tutor`) |

An administrator (Admin: Manage) or a superadmin holds every grant, as they hold Manage in every app. Grants apply at the sites the person works at (`users.siteIds`; none means every site). The mapping is `apps/courses/src/access/grants.ts`. The Classes, Pool deck and Academy levels stay on the role editor after those apps leave Turnfin, because they now say what a role opens in Courses.

**The log.** Every change writes one row to `courses_log` in the same transaction: who, what, which record, when. Turnfin's activity log stops receiving course changes at the switch and stays readable.

## What Turnfin still needs from it

Turnfin's other apps use course data today through plugs. After the switch they ask Courses over one server-to-server API, `/api/turnfin/v1`, signed with a shared secret; a small Turnfin module holds the plugs and calls it. If Courses does not answer, the plug says "not available", as a switched-off app does today.

| Turnfin needs | For |
| --- | --- |
| who is teaching when (classes, assessments, course sessions) | Rota, Plan (test) |
| one line per site | Admin › Sites |
| what waits for a person | Home |
| everything held about a person | HR's subject export |
| a site's area was renamed | keeping stored area names right |
| a candidate passed | the qualification on their staff record |

Swimmer search, the member directory, desk measures and failed-payment notices only served the parts that are moving, so they leave with them.

## What does not change

- The rules that protect people ([apps.md](apps.md#rules-that-protect-people)): who sees medical notes, the pool deck's limits, nobody decides their own.
- The parent app's API contract ([parent-api.openapi.json](parent-api.openapi.json)) and the Academy booking API: same paths and shapes on the new host. The old host keeps answering until both products point at the new one.
- Writes: authorise, validate, guard, write and log in one transaction; errors a person can fix are return values.
- No real swimmer data in tests, screenshots or examples. No migration, script or deploy against a real database without the owner's yes.
- Plain staff words, honest states, WCAG 2.2 AA, shared devices signed out when idle.

## The order

Each step is its own pull request, checked on a preview. Old screens stay live in Turnfin until step 8.

| Step | What | Needs the owner |
| --- | --- | --- |
| 1 | **Foundation**: the app, its tables, Continue with Turnfin, grants from roles, the log, checks in CI | yes: the Vercel project, the domain and the shared secret |
| 2 | **The design**: mockups of the desk, the pool deck and a course page | yes: approving it |
| 3 | **Desk**: swimmers, classes, places, waiting lists, assessments | |
| 4 | **Pool deck**: today, registers, competencies, assessments | |
| 5 | **Courses with dates**: short courses and Academy courses as one kind of thing, on their own tables | |
| 6 | **Money and the day**: failed payments, cancellations, the duty page, reports | |
| 7 | **APIs**: parent, parent-admin, Academy, and `/api/turnfin/v1` with Turnfin's plugs moved onto it | |
| 8 | **The switch**, one site first: Classes, Pool deck, Analytics and Academy switched off in Turnfin, old links redirected. Nobody needs a new account | yes: each site |
| 9 | **Removal** of the old modules and routes from Turnfin, a month after the last site | yes |

## What this costs

Said plainly, against the pillars ([PRODUCT.md](../PRODUCT.md)):

- **Simple, easy to use.** People, roles and passwords stay in one place, and one sign-in covers both. Staff still move between two addresses.
- **Easy to audit.** A change is in one of two logs, depending on where it was made.
- **Change without breaking.** Rota and Plan depend on a network call where they had a function call. This was tried on 28 September 2026 and reversed ([D11](decisions.md)); the difference now is that only one boundary crosses the network and it fails closed.
- **Modern.** Two designs and two sets of screens exist until step 9.
