# Jobs at places, and one shared way to send work

*Plan, 24 October 2026. Fernando chose Option B of the architecture review (canvas: https://claude.ai/artifact/YSSCX8tshunSXhQbwx7EcQ) and confirmed that some staff hold two different jobs, such as reception at one site and duty manager at another. Decision records: [0015](decisions/0015-jobs-at-places.md) and [0016](decisions/0016-shared-work-layer.md). Nothing here is built yet. This plan is steps 3 and 4 of the wider direction in [architecture/platform-and-apps.md](platform-and-apps.md), which puts a safety net and app switches first.*

## Why

Turnfin's model holds up: apps, a level per app, the role's home page and Turnfin Me. Three things strain as it grows:

1. **One role per person.** `User.staffRoleId` plus `User.siteIds` means a role's levels apply at every site the person works at. Someone who is a receptionist at one site and a duty manager at another needs a made-up combined role, which also gives duty-manager access at both sites.
2. **The same plumbing in every app.** Refunds, Coinage and Incidents each keep their own email queue (Refunds and Coinage copy for copy). Six apps check uploaded files in their own way. Purchasing never tells approvers that an order is waiting.
3. **Waiting work is incomplete.** Home's "Waiting for you" is built from app home cards, but Docs reviews, parent access requests and Rota's Timepoint updates never reach it.

## What changes, in the five sentences

Only sentence 2 changes:

> 2. **Roles.** A role is a job, such as Receptionist or Instructor. For each app the role has a level, like None, Use or Manage. Each level includes the ones before it. **A person holds one or more jobs; a job is a role at the sites it covers.**

Sentence 3 stays as it is, and Home's "Waiting for you" becomes complete (phase 3).

## The rule for jobs

- A **job** is a role plus the sites it covers. No sites ticked means every site, as Works at does today.
- At the site you are working in, each app's level is the **highest level among your jobs that cover that site**. Levels include the ones before them, so this is simply the combination of those jobs' permissions.
- What a level reaches does not change: Swim school, Pool deck, Tasks, Incidents, Short courses, Stock, the CCTV log, Training and Rota apply at a job's sites; HR "Their team" reaches the people you manage; everything else applies everywhere.
- Your **main job** (the first one) names your Home ("Front of House") and is the role shown beside your name. When you work at a site that only another job covers, Home takes that job's name.
- **Works at** becomes every site any of your jobs covers. It is still stored on `User.siteIds`, so the site picker, the organisation chart and "people at this site" keep working unchanged.
- Only a superadmin gives a job whose role holds HR, as now. The keyholder guard counts jobs.
- Role previews ("View as") still preview one role.

### Example

| Job | Sites |
| --- | --- |
| Duty manager (main) | Site A |
| Receptionist | Site B |

At Site A they get duty-manager access, and Home carries the Duty manager role's Home name. At Site B they get receptionist access, and Home says "Front of House". No combined role is needed.

## The shared work layer, smaller than first drawn

The canvas showed a stored work-item table. Looking at the code changed that, in the direction of fewer concepts:

- **No work-item table.** Home already builds "Waiting for you" from each app's home card (`registerHomeCard`, items with `attention`). A stored copy would be a second source of truth that could drift. Instead, every app reports its waiting work through that seam, and the gaps are filled.
- **One email outbox in Core** replaces `RefundNotification`, `CoinageNotification` and `IncidentNotification`. It uses the Refunds design, which is the most complete: queued in the same transaction, sent after commit, retried and audited. Apps still decide *when* and *to whom*; Core does the *how*.
- **One file check in Core** (type by first bytes, size limit, the error messages) replaces the six copies. Files stay in each app's own tables, because they are that app's records.
- **Comments are not unified.** Task comments, course review comments, incident addenda and statements have different shapes and rules. Merging them would add a concept, not remove one.

## Phases

Each phase is its own PR: preview first, then main. Each passes `npm run typecheck`, `npm run lint` and `npm test`, and keeps behaviour the same unless the phase says otherwise. Database changes only add.

### 1. Tidy the access layers (small, no staff-visible change)

- Convert any role still without levels (`src/lib/staff/convert-roles.ts`), then remove the "not yet converted" branch in `sessionUserFor` (`src/lib/staff/session-user.ts`).
- Stop reading `StaffRole.screens`, `StaffRole.home` and the legacy `User.role`. `StaffRole.permissions` stays as the cache written on save, because the directory and the keyholder guard read it.
- Leave the columns and `RoleAssignment` in place; dropping them is an owner decision (below).

### 2. Jobs at places

**2a. The table and a mirror (no visible change).**
- An additive migration adds `StaffJob` in `prisma/schema/core.prisma` with these columns: `id`, `orgId`, `userId`, `roleId`, `siteIds String[]` (empty means every site), `isMain`, `grantedById` and `createdAt`. `(userId, roleId)` is unique: the same role at two sites is one job with two sites.
- The same migration gives every person with a role one main job, copied from `staffRoleId` and `siteIds`.
- Every action that sets a person's role or sites (`src/lib/staff/actions/staff.ts`, `src/lib/people/actions.ts`) writes their main job in the same transaction. Reads don't change yet.

**2b. Read from jobs (no visible change while everyone has one job).**
- `ACCOUNT_SELECT` loads the jobs. `sessionUserFor` builds the flat permissions from the jobs that cover the working site, and builds the policy grants from each job's sites.
- `User.staffRoleId` mirrors the main job's role, and `User.siteIds` mirrors every site any job covers. Both are written by the job actions.
- Core gains `rolesAt(userId, siteId)` and `holdersOfRole(roleId, siteId?)` in `src/lib/directory.ts`, replacing `staffRoleIdOf`. They are used by:
  - Tasks: a template's roles must be held at the task's site.
  - Purchasing: the approval rule's role must be held at the order's site.
  - Training's people chooser: a person appears under each of their roles.
  - Docs' role teams.
- The keyholder guard (`src/lib/staff/keyholders.ts`) counts jobs. Google sign-in's "Waiting for a role" means no jobs.
- Tests:
  - `session-user` cases: two jobs at two sites, the same app at different levels, an every-site job beside a one-site job, and an HR "Their team" job.
  - A policy matrix row for a person with two jobs.
  - Keyholder races across jobs.

**2c. Give someone a second job (staff will notice).**
- Admin › Staff › a person: "Role and sites" becomes **Jobs**, a list of *role · sites* rows with Add a job, Change, Remove and Make main. The person must keep at least one job unless they are deactivated.
- Each change writes one audit row (Admin): who, which person, which job, before and after.
- **Access at a glance:** a person's page shows, site by site, each app's level and which job gives it. With many people and departments, an admin must be able to answer "what can this person do at Site B, and why?" without working it out. Training a new admin starts here.
- **Retire combined roles:** list the roles that only exist to combine two jobs (for example "Receptionist + Instructor"). For each holder, give the two plain jobs at the right sites, check their access at a glance, then archive the combined role. This is done by admins, a few people at a time, and is audited like any other change.
- The role editor does not change.
- CHANGELOG entry and version bump.

**2d. Documents.**
- Update sentence 2 in [how-turnfin-works.md](../how-turnfin-works.md), the model in [platform-access.md](../platform-access.md), and the "one role" lines in AGENTS.md.
- ADR 0015 becomes Accepted.

### 3. "Waiting for you" complete (staff will notice)

- Docs reports reviews waiting for the signed-in approver (today only on Docs › My work).
- The swim school reports pending parent access requests.
- Rota reports shift changes still to update in Timepoint.
- Tasks stops creating today's tasks while Home is read (`ensureTasks` in `tasks/features/day/server/data.ts`). The 01:30 job (`/api/cron/tasks`) and opening the day already create them, so Home stops writing.
- Home items may carry `since` (when the oldest item arrived) so "Waiting for you" can put the oldest first. This is an additive field on `HomeItem`; apps that don't send it keep today's order.

### 4. One email outbox (staff will notice: Purchasing approvers get emails)

- **Core:** `src/lib/notify` holds the `Notification` outbox. Its columns are `orgId`, `module`, `kind`, `ref`, `recipientId`, `status` (PENDING, SENDING, SENT, FAILED or SKIPPED), `attempts`, `error` and `sentAt`, unique on `(module, ref, recipientId)`. It provides `queue()` inside the caller's transaction and `deliver()` after commit, plus a "Send again" helper. It is built from Refunds' `queueNotifications` and its notification-sending code, and it uses `src/lib/email` for sending.
- **Apps move one at a time:**
  1. Refunds.
  2. Coinage.
  3. Incidents, which gains retries.
  4. Purchasing, which starts telling approvers that an order is waiting.
- **Old tables:** each app's old table stops receiving rows and stays readable for history. Dropping it is an owner decision.
- Turnfin Me's daily digest and shift-change emails are personal reminders, not work. They stay as they are.

### 5. One file check

- `src/lib/files` checks uploads: type by first bytes, a size limit, and plain error messages. Refunds, Tasks, Incidents, Training and Docs use it in place of their own copies.
- Storage doesn't change: bytes stay in each app's tables, and Incidents footage stays in Vercel Blob. Moving files to Blob is a separate decision.

## Not in this plan

- **Regrouping the apps or moving the swim school's pages under `/swim-school`.** Both were on the canvas. Once jobs and a complete "Waiting for you" are in place, the app rail matters less, so this churn isn't worth it now.
- **Turning more apps into "applies at sites"** (for example Refunds Manage at one site). Jobs make it possible later, one app at a time, by changing that app's `reach`.
- **A sixth concept.** Workspaces, permission bundles and separate apps all stay out.
- **Department-scoped access** (for example, Rota Plan for the gym department only). A job covers sites. If a real case needs a department, it starts as a filter inside that app, not as a new kind of access.

## Rolling it out in a live app

Turnfin is used every day by several departments across several sites, so:
- Phases 1, 2a and 2b change nothing anyone sees. Each one can be undone by reverting its PR, and its migration only adds.
- Jobs reach staff in 2c. Start with the few people who hold two jobs today, at one site, before retiring combined roles elsewhere.
- Each staff-visible phase (2c, 3, 4) gets a What's new entry written for staff, and a one-line note where admins set jobs.

## Decisions Fernando still owns

These don't block phases 1 to 3.

1. **Admin's five setup ticks.** AGENTS.md allows at most two extras per app, and Admin has five. Folding them into one "Keeps the setup lists" tick would give every holder of any one tick all five. Recommendation: fold them, after checking which roles hold only some of them, because those roles would gain the rest.
2. **Dropping old columns and tables:** `StaffRole.screens`/`home`, `User.role`, `RoleAssignment`, and the three old notification tables, each after its phase has run on main for a month. Each drop needs a migration that removes something, so it waits for his yes.
3. **Purchasing approves by role and amount.** This is data, not a role check in code, so it stays. With jobs it means "holds that role at the order's site". Recommendation: keep it.
