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

It is written again from scratch. Turnfin's rules for apps (the six-part contract, the frame, the five-page limit, levels and extras, Turnfin Sheet) do not bind it. What still binds it is in [What does not change](#what-does-not-change).

## What it shares, and what it does not

| | Shared with Turnfin | Its own |
| --- | --- | --- |
| Repository | yes: `apps/courses` | its own `package.json`, lint, tests and `AGENTS.md` |
| Database | yes: the main database, and the tables it already has | new tables in `prisma/schema/courses.prisma`, prefixed `courses_` |
| Deploy | no | its own Vercel project, `turnfin-courses`, root `apps/courses`, like Turnfin Me and the Academy site |
| Accounts and sign-in | no | `courses_accounts`, its own session cookie on `courses.turnfin.app` |
| Access | no | its own short list of grants per account |
| Design | no | its own, approved from mockups before any screen is built |
| Code | nothing imported from `src/` | everything under `apps/courses/src` |

**Why its own Vercel project, when the same one was allowed.** A standalone app inside Turnfin's build would share Turnfin's root layout, theme, lint rules and sign-in cookie, and `/courses` already means swim classes there. A second root layout means moving every Turnfin route. `apps/me` and `apps/academy` already deploy from this repository as their own projects, so this is the existing pattern, and it changes nothing in Turnfin. Creating the project and the domain needs the owner's yes.

## Data

- **The tables keep their names and rows.** Courses takes over the tables in `activities.prisma`, `activities.short-courses.prisma` and `academy.prisma`. Nothing is copied. Until the switch, Turnfin's code and Courses read and write the same rows, so both can run at once.
- **One migration history.** The database has one set of migrations, `prisma/migrations`, applied by Turnfin's production build. Courses adds to it and never runs migrations itself. Database changes still only add.
- **Its own client.** Courses generates its own Prisma client from `prisma/schema` into `apps/courses/src/generated/prisma`. It queries only its own tables, plus `clubs` (sites, read only) and `users` (names for the person behind an account, read only). Lint refuses any other model.
- **New tables** carry `orgId` and the `courses_` prefix: `courses_accounts`, `courses_sessions`, `courses_log` so far.

## Accounts, sign-in and access

- **An account** (`CoursesAccount`) is an email, a name, a password, the sites it works at and its grants. Deactivate, never delete.
- **The person behind it.** The existing tables record staff by their Turnfin person id (a class's instructor, who marked a register, who booked an assessment). Those columns stay, so an account that teaches or writes records is linked to that person record (`personId`). The link is identity only: Turnfin's password, role and levels are never read. A later step can add account columns beside the person columns and stop needing the link.
- **Sign-in** is email and password, checked with bcrypt, with a random session token stored hashed in `courses_sessions` and sent as an `HttpOnly`, `Secure`, `SameSite=Lax` cookie for `courses.turnfin.app` only. Signing in to Turnfin does not sign you in here, and the other way round.
- **Grants**, per account, at its sites. Code asks for a grant, never a job title:

| Grant | Opens |
| --- | --- |
| `desk` | swimmers, places, moves, waiting lists, assessment and course bookings, failed payments |
| `teach` | the pool deck for their own classes and courses |
| `lead` | the pool deck for any class |
| `tutor` | Academy courses: candidates, checks, payment, registers, results |
| `manage` | programmes, classes, course lists, prices, uploads, reports |
| `cancel` | cancelling today's sessions |
| `accounts` | accounts and their grants |

- **The log.** Every change writes one row to `courses_log` in the same transaction: who, what, which record, when. Turnfin's activity log stops receiving course changes at the switch and stays readable.

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
| 1 | **Foundation**: the app, its tables, accounts, sign-in, grants, the log, checks in CI | yes: the Vercel project and domain |
| 2 | **The design**: mockups of the desk, the pool deck and a course page | yes: approving it |
| 3 | **Desk**: swimmers, classes, places, waiting lists, assessments | |
| 4 | **Pool deck**: today, registers, competencies, assessments | |
| 5 | **Courses with dates**: short courses and Academy courses as one kind of thing, on their own tables | |
| 6 | **Money and the day**: failed payments, cancellations, the duty page, reports | |
| 7 | **APIs**: parent, parent-admin, Academy, and `/api/turnfin/v1` with Turnfin's plugs moved onto it | |
| 8 | **The switch**, one site first: accounts made from today's staff by a script (dry-run until `--confirm`), Classes, Pool deck, Analytics and Academy switched off in Turnfin, old links redirected | yes: each site, and the script on Production |
| 9 | **Removal** of the old modules and routes from Turnfin, a month after the last site | yes |

## What this costs

Said plainly, against the pillars ([PRODUCT.md](../PRODUCT.md)):

- **Simple, easy to manage.** Staff who use both get two sign-ins, and a manager keeps a person in two places. "One sign-in and one set of records" is no longer true of courses.
- **Easy to audit.** A change is in one of two logs, depending on where it was made.
- **Change without breaking.** Rota and Plan depend on a network call where they had a function call. This was tried on 28 September 2026 and reversed ([D11](decisions.md)); the difference now is that only one boundary crosses the network and it fails closed.
- **Modern.** Two designs and two sets of screens exist until step 9.
