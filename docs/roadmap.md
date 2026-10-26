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

Step 1 comes first, because nothing else is safe without it. Step 5 can start as soon as step 1 is done and the design is approved, and runs alongside steps 2 to 4.

## 1. Safety net

Today a merge to `main` deploys and migrates production, and nothing checks it automatically.

- A GitHub check on every pull request: typecheck, lint (boundary and UI rules), tests and a build against the development database.
- `main` protected: it accepts only pull requests that pass the check.
- A test floor for every app: its rules, every front-door function and every event it emits or handles. Start with the thinnest: Refunds, Coinage, Stock, the CCTV log, Site Monitoring, Tasks, HR.
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
- **3c. Read from jobs (no visible change while everyone has one job).** The session builds flat permissions from the jobs covering the working site and policy grants from each job's sites. `rolesAt` and `holdersOfRole` replace `staffRoleIdOf` in Tasks, Purchasing, Training and Docs. The keyholder guard counts jobs. Tests: two jobs at two sites, one app at different levels, an every-site job beside a one-site job, an HR "Their team" job, keyholder races.
- **3d. Jobs in Admin (staff notice).** Admin › Staff › a person: **Jobs** (add, change, remove, make main; at least one while active), each change audited, and **access at a glance**. Combined roles are retired person by person, starting with the few people who hold two jobs, at one site.

**Done when** a receptionist at one site who is duty manager at another holds two plain jobs, gets the right access at each site, and an admin can see why at a glance.

## 4. Platform services

- **Waiting for you, complete.** Docs reviews, the swim school's parent access requests and Rota's Timepoint updates report through home items; items may carry `since` so the oldest comes first; Home stops creating Tasks' day while it is read (the 01:30 job and opening the day already do). No stored work-item table.
- **One email outbox** (`src/lib/notify`): queue in the caller's transaction, deliver after commit, retry, audit, "Send again". Apps move one at a time: Refunds, Coinage, Incidents (gains retries), Purchasing (starts emailing approvers). Old queue tables stop receiving rows and stay readable.
- **One file check** (`src/lib/files`): type by first bytes, a size limit, plain errors, used by Refunds, Tasks, Incidents, Training and Docs. Storage does not move.
- The email-code check and the rate limit move from the three public APIs into the API toolkit; one date helper replaces the apps' own.

Comments are not unified: task comments, course reviews, incident addenda and statements have different rules, and merging them would add a concept.

**Done when** everything waiting for a person reaches Home, no app keeps its own email queue or file check, and Purchasing approvers are emailed.

## 5. The 2.0 design

The design is approved: **Turnfin Glass**, written in [../DESIGN.md](../DESIGN.md) (D13, 25 October 2026). The build order is in its "How it is built".

- The theme and UI kit are rebuilt first (tokens, the glass material, springs, frame, page shell, states), then Home and the app frame, then each app's screens, one app per pull request.
- The old look is removed as each part is replaced: no two designs in one screen, and none left at the end. Turnfin Me and the Academy booking site follow with their own pull requests.
- The help centre's guides and screenshots are redone for the new screens.

**Done when** every screen in Turnfin and both connected products in this repository use the 2.0 design, and no old theme file, token or component remains.

## 6. Events between apps

Each cross-app side effect becomes an event when its code is next touched, starting with `rota.shift.changed`. Seams that are really plugs (home items, site summaries, person-file sections) stay plugs.

**Done when** no app calls another app to cause a side effect.

## 7. New apps

Each follows "Adding an app" in [apps.md](apps.md) and the checklist in [../AGENTS.md](../AGENTS.md), and ships switched on at one site first.

## Decisions the owner still holds

These do not block steps 1 to 4.

1. **Admin's five setup extras.** The rule is at most two extras per app, and Admin has five. Recommendation: fold them into one "Keeps the setup lists" extra, after checking which roles hold only some of them, because those roles would gain the rest.
2. **Dropping legacy columns and tables:** `StaffRole.screens` and `home`, `User.role`, `RoleAssignment`, and the three old notification tables, each after its step has run on `main` for a month. Each is a removing migration, so each waits for the owner's yes.
3. **Purchasing approves by role and amount.** Recommendation: keep it; with jobs it means "holds that role at the order's site".
4. **Unused Neon databases** (`turnfin-dev-db`, `turnfin-activities-db`, `turnfin-activities-dev-db`): removing them is the owner's call.

## Not in 2.0

- Splitting Turnfin into separately deployed services.
- Regrouping the apps, or moving the swim school's pages under one path.
- Department-scoped access. A job covers sites; a real department case starts as a filter inside that app.
- A stored work-item table, permission bundles, workspaces, or any other sixth concept.
