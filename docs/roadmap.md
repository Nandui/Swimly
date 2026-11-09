# Turnfin 2.0: the roadmap

What is being built for 2.0, in order, and how each step is known to be done. The target it builds towards is in [architecture.md](architecture.md); the product it serves is in [../PRODUCT.md](../PRODUCT.md).

2.0 **evolves the live app**: same repository, same data, same deploy. Nothing is rewritten from scratch. Each step lands as small pull requests, preview first, then `main`; database changes only add; anything staff will notice gets a What's new entry.

**Version.** The repository stays on 1.x until the first change staff will notice from this roadmap ships; that release is **2.0.0**.

## The order

| Step | What | Staff notice? | Needs the owner |
| --- | --- | --- | --- |
| 1 | Safety net | no | yes: protecting `main` |
| 2 | App switches | admins only | |
| 3 | Jobs at places | yes | yes: retiring combined roles |
| 4 | Platform services | yes | |
| 5 | The 2.0 design | yes | yes: approving the design |
| 6 | Events between apps | no | |
| 7 | New apps | yes | yes: each new app |
| 8 | Fewer front-of-house apps | yes | yes: each data copy and table drop |
| 9 | Training sets up learning; Qualifications keeps qualifications | yes | yes: the rules change on Production |

Step 1 comes first, because nothing else is safe without it. Step 5 can start as soon as step 1 is done and the design is approved, and runs alongside steps 2 to 4.

## 1. Safety net

A merge to `main` deploys and migrates production.

- **Built:** a GitHub check on every pull request (`.github/workflows/check.yml`): typecheck, lint (boundary and UI rules), tests and a build that reaches no database.
- `main` protected: it accepts only pull requests that pass the check. Still open, and the owner's to switch on.
- A test floor for every app: its rules, every front-door function and every event it emits or handles. Every app meets it.
- `npm run lint` runs on Windows as well as Linux.

**Done when** no change can reach `main` without passing the checks, and every app meets the test floor.

## 2. App switches

**Built** ([architecture.md](architecture.md#app-switches)): the `AppSwitch` setting, Admin › Apps for superadmins, one `appOn` that the session, menus, Home, plugs, events, front doors and API routes ask, and the switched-off test.

- The platform stores, per organisation, whether each app is on, off or on at some sites; only a superadmin changes it, with an audit row.
- An app that is off loses its pages, menu, home items, listeners and API routes; its front door answers "not available".
- A test run switches each app off in turn.

**Done when** any one app can be switched off and the whole suite still passes, and a new app can go live at one site.

## 3. Jobs at places

The model is in [architecture.md](architecture.md#access-who-can-do-what-where).

- **3a. Tidy access (no visible change).** Convert any role still without levels (`src/lib/staff/convert-roles.ts`) and remove the unconverted branch in `sessionUserFor`. Stop reading `StaffRole.screens`, `StaffRole.home` and `User.role`; `StaffRole.permissions` stays as the cache written on save.
- **3b. The table and a mirror (no visible change).** An additive migration adds `StaffJob` and gives everyone with a role one main job. Every action that sets a person's role or sites writes their main job in the same transaction.
- **3c. Read from jobs (no visible change while everyone has one job).** The session builds flat permissions from the jobs covering the working site and policy grants from each job's sites. `rolesAt` and `holdersOfRole` replace `staffRoleIdOf` in Tasks, Purchasing, Training and Docs. The keyholder guard counts jobs. Tests: two jobs at two sites, one app at different levels, an every-site job beside a one-site job, an HR Report job, keyholder races.
- **3d. Jobs in Admin (staff notice).** Admin › Staff › a person: **Jobs** (add, change, remove, make main; at least one while active), each change audited, and **access at a glance**. Combined roles are retired person by person, starting with the few people who hold two jobs, at one site.

**Done when** a receptionist at one site who is duty manager at another holds two plain jobs, gets the right access at each site, and an admin can see why at a glance.

## 4. Platform services

- **Waiting for you, complete.** Docs reviews, the swim school's parent access requests and Rota's Timepoint updates report through home items; items may carry `since` so the oldest comes first; Home stops creating Tasks' day while it is read (the 01:30 job and opening the day already do). No stored work-item table.
- **One email outbox** (`src/lib/notify`): queue in the caller's transaction, deliver after commit, retry, audit, "Send again". Apps move one at a time: Refunds, Coinage, Incidents (gains retries), Purchasing (starts emailing approvers). Old queue tables stop receiving rows and stay readable.
- **One file check** (`src/lib/files`): type by first bytes, a size limit, plain errors, used by Refunds, Tasks, Incidents, Training and Docs. Storage does not move.
- The email-code check and the rate limit move from the three public APIs into the API toolkit; one date helper replaces the apps' own.
- **One search** (D19; built 2 November 2026, 3.0.0): the `registerSearch` plug, with the swim school's members first, people from the platform, and apps and pages matched in the frame. Results respect permissions and show the least that names them. Other apps register their records as they need to be found.

Comments are not unified: task comments, course reviews, incident addenda and statements have different rules, and merging them would add a concept.

**Done when** everything waiting for a person reaches Home, no app keeps its own email queue or file check, Purchasing approvers are emailed, and one search finds pages, people and members.

## 5. The 2.0 design

The design is approved: **Turnfin Sheet** (D20, 1 November 2026), written in [../DESIGN.md](../DESIGN.md). It replaces Turnfin Glass (D13), which is built and live (25 to 27 October 2026), so step 5 now re-themes that work rather than starting again. The build order is in DESIGN.md's "How it is built".

- The theme and kit are re-themed first (the tokens in the theme file, the ground and fin, the page sheet, frame, page shell, states), then Home and the app frame, then each app's screens, one app per pull request.
- The frame is the one worked out from the job (D19, [architecture.md](architecture.md#the-frame); built 2 November 2026, 3.0.0): Home as one list of work, a sidebar that drills in, no top tabs, one shell, and every app at five work pages plus Set up, with the rest nested under them.
- The old look is removed as each part is replaced: no two designs in one screen, and none left at the end. Turnfin Me and the Academy booking site follow with their own pull requests.
- The help centre's guides and screenshots are redone for the new screens.

**Done when** every screen in Turnfin and both connected products in this repository use the 2.0 design, and no old theme file, token or component remains.

## 6. Events between apps

Each cross-app side effect becomes an event when its code is next touched, starting with `rota.shift.changed`. Seams that are really plugs (home items, site summaries, person-file sections) stay plugs.

**Done when** no app calls another app to cause a side effect.

## 7. New apps

Each follows "Adding an app" in [apps.md](apps.md) and the checklist in [../AGENTS.md](../AGENTS.md), and ships switched on at one site first.

## 8. Fewer front-of-house apps

Swim school, Short courses, Refunds, Coinage and Payments become **Classes**, **Finance requests** and **Academy** ([D24](decisions.md)). Smallest first, each shipped and checked on `main` before the next starts:

1. **Payments into Classes** (built 2 November 2026, 3.2.0). Its pages and home items moved into the swim school's module and frame (Failed payments now under Swimmers); Payments' Use went to Desk, its Manage to Manage. Its tables moved into `activities.prisma` with their names, so nothing was copied.
2. **Finance requests** (built 3 November 2026, 3.3.0). Refunds and Coinage are one app with one frame and Overview; Use and Manage carried over. They kept their tables and URLs (owner default). Still to do: one `FinanceRequest` table with a detail table per kind, one flow and one queue for finance, its rows copied from the Refunds and Coinage tables.
3. **Academy** (built 3 November 2026, 3.3.0). Its own module in Team, levels Tutor and Manage, at `/academy`; it kept its tables and the Academy booking site's API.
4. **Short courses into Classes** (built 3 November 2026, 3.3.0). Their pages and code joined the swim school's module, which is shown as **Classes**; they kept their own tables and registers (owner default). Still to do: short courses as an activity type on `Programme.activityType` ([architecture.md](architecture.md#activity-types)), the desk booking them as classes and instructors taking their registers on the pool deck.

Every copy is a script, dry-run until `--confirm`, run on Production only with the owner's yes. Old tables stop receiving rows and stay readable; each is dropped a month later, with the owner's yes. A merged app that has not been re-themed yet (step 5) gets the 2.0 design in its merge, so nothing is designed twice.

**Done when** reception works in two apps, Classes and Finance requests; Payments, Refunds, Coinage and Short courses are gone from the catalogue; and finance decides requests without any swimmer level.

## 9. Training sets up learning; Qualifications keeps qualifications

Training stops tracking compliance; a new app, Qualifications, keeps it ([D26](decisions.md)). Two releases, the second only after the first has run on `main`:

1. **Qualifications** (built 3 November 2026). Certificates to check, Expiring and In-service hours move from Training into the new app at `/staff-qualifications`, with its own home items; old Training links redirect. Each expiring row has **Assign the course**, through the `registerQualificationRenewals` plug Training provides. Training's Manage counts as Keep and the app follows Training's switch until it has its own. The hours tables move to `qualifications.prisma` with their names (no migration); session registers stop logging hours, and Turnfin Me reads a person's hours from Qualifications.
2. **Training cut down.** A course is sections of steps, with live session and trainer sign-off as kinds of step. Assigning is by hand (people, a job or a site, an optional due date) or on joining a job, never repeating. **Progress** per course and per person replaces Matrix and Reports. Each rule becomes "assign on joining this job" by a script, dry-run until `--confirm`; repeats and the old expiry and due-again dates stop being read, done dates stay, and the 05:30 job stops assigning "due again". Completion certificates and Check a certificate go: Turnfin Me's certificate endpoint answers "not available" first, and is removed a release later.

**Done when** Qualifications keeps every certificate check, expiry and hour with nothing lost, Training has no expiry, certificate or compliance page, and a course finished in Turnfin Me adds its qualification for Qualifications to track.

## Decisions the owner still holds

These do not block steps 1 to 4.

1. **Admin's five setup extras.** The rule is at most two extras per app, and Admin has five. Recommendation: fold them into one "Keeps the setup lists" extra, after checking which roles hold only some of them, because those roles would gain the rest.
2. **Dropping legacy columns and tables:** `StaffRole.screens` and `home`, `User.role`, `RoleAssignment`, the three old notification tables, and the tables step 8 copies from, each after its step has run on `main` for a month. Each is a removing migration, so each waits for the owner's yes.
3. **Purchasing approves by role and amount.** Recommendation: keep it; with jobs it means "holds that role at the order's site".
4. **Unused Neon databases** (`turnfin-dev-db`, `turnfin-activities-db`, `turnfin-activities-dev-db`): removing them is the owner's call.

## Not in 2.0

- Splitting Turnfin into separately deployed services.
- Regrouping the apps beyond step 8, or moving the swim school's pages under one path.
- Department-scoped access. A job covers sites; a real department case starts as a filter inside that app.
- A stored work-item table, permission bundles, workspaces, or any other sixth concept.
