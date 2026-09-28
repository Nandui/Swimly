# Handover: Core, Work and Activities (28 September 2026, evening)

For Fernando, to pick up on another machine. Everything is on the branch
`core-work-activities` (this file) and on `dev`. It is **not** on `main`, and
production (turnfin.app) is unchanged.

## 1. Where things stand

Turnfin is now three parts (owner decision, 28 September 2026; full detail in
[architecture.md](architecture.md)):

- **Core**: sign-in, people, roles, sites, audit, the portal. Lives in the Work app.
- **Work**: Docs, Refunds, Training, HR, Rota. Vercel project `swimly-crm`, serves turnfin.app.
- **Activities**: the swim school (renamed from Aquatics; Swim school is its first
  type). Its own Next.js app, `apps/activities`, Vercel project `turnfin-activities`.
  Staff never visit it directly: Work forwards the swim-school paths to it
  (`src/lib/zones.ts`), so there is still one address and one sign-in.

Commits on `dev`, oldest first:

| Commit | What |
| --- | --- |
| b09dbb4 | Stage 1: Core / Work / Activities split in code, lint-enforced |
| 49eb98d | Rename Aquatics to Activities; dev-database guard (`DATABASE_ENVIRONMENT`) |
| d531524 | Stage 2: Activities reads people and sites only through `src/lib/directory.ts` |
| 471a685 | Stage 3: `apps/activities` as its own app (multi-zones) |
| 370e17b, b3f901b | Read Neon's `DATABASE_URL_UNPOOLED`; which database serves what |

Checks at 471a685: typecheck (both apps), lint, 506/506 tests, and a production
build of both apps tested together locally (`npm run sandbox -- --production`).

## 2. Decisions made today

- Only **Activities** gets its own database now. Core and Work stay together in
  the main database; Docs and HR keep their separate ones.
- The apps share data by **database access, not APIs**: each app has its own
  database and reads Core through `src/lib/directory.ts`. An API comes later,
  only if Activities is ever hosted for a customer on its own.
- Dev never uses production data again: separate dev databases, fictional data only.

## 3. Databases (Neon, Frankfurt, via Vercel's Neon integration)

| Neon database | Holds | Attached to |
| --- | --- | --- |
| `swimly-db` (assumed; set by hand, not attached) | Production Core and Work, and Activities for now | Work, Production |
| `turnfin-dev-db` | Dev Core and Work. **Tables created** (27 migrations applied by the dev deploy). **No accounts yet.** | Work, Preview + Development |
| `turnfin-activities-db` | Production Activities. Empty; not used by code yet. | Activities, Production, as `ACTIVITIES_*` |
| `turnfin-activities-dev-db` | Dev Activities. Empty; not used by code yet. | Activities, Preview + Development, as `ACTIVITIES_*` |

Confirm `swimly-db` really is the production main database.

## 4. Still to do in Vercel (by you: these hold secrets)

On **turnfin-activities**:
1. Connect `turnfin-dev-db` for **Preview + Development**, no prefix.
2. `AUTH_SECRET` for Production and Preview. Production must equal Work's
   Production value, and Preview must equal Work's Preview value, or staff are
   signed out when they move between the apps.
3. `DATABASE_URL` and `DIRECT_URL` for Production: the production main database.
4. `PARENT_*` (8) and `SWIMLY_OPERATIONS_*` (3) for Production, as on Work.
5. Settings → Deployment Protection: **turn Vercel Authentication off**. While
   it is on, Work cannot load the Activities pages.

Already done: production branch is `main`; `WORK_ORIGIN`, `WORK_URL` and
`DATABASE_ENVIRONMENT=development` are set; Work has `ACTIVITIES_URL`.

On **swimly-crm** (Work):
- Check where Preview `DOCS_DATABASE_URL` / `DOCS_DIRECT_URL` point. If at
  production Docs, dev.turnfin.app is reading real documents. Fix: a
  `turnfin-docs-dev-db` for Preview.

## 5. First sign-in on dev

dev.turnfin.app runs on `turnfin-dev-db`, which has no accounts. Create the
first admin from any machine, in the Swimly folder, with `DATABASE_URL` set to
`turnfin-dev-db`'s **unpooled** URL (Vercel → Storage) and `SEED_ADMIN_EMAIL`,
`SEED_ADMIN_PASSWORD` set to a new dev-only account. Then run `npm run db:seed`.
It creates the standard roles and that admin. Swimmers and classes are added in
the app, or ask for a fictional-data seed.

When sections 4 and 5 are done, push anything to `dev` (or redeploy it) and
check dev.turnfin.app: sign-in, Schedule, Add a swimmer, the instructor deck,
Docs, Refunds.

## 6. Next code work (not started)

> **Paused (owner, 28 September 2026).** The simplification plan (`docs/how-turnfin-works.md`, pillars: simplicity, easy to manage) folds Activities back into one app and keeps one main database. Do not start the steps below.

**Move the swim-school tables to the Activities database.** The code already
reads people and sites through one file, so the plan is:
1. A second Prisma client for Activities (`ACTIVITIES_DATABASE_URL`,
   `ACTIVITIES_DATABASE_URL_UNPOOLED`), with its own migrations folder, as Docs
   and HR have.
2. Drop the database links from Activities tables to `User` and `Club`
   (`User.coursesTaught`, `Club.programmes/students/courses`); keep the ids.
3. Activities gets its own audit table; the Activity screen shows both logs.
4. Work reads the contributions (Classes column on Staff, site counts on Sites)
   through a read-only connection to the Activities database.
5. Prove it on dev with fictional data. Production last: backup, copy the
   Activities tables to `turnfin-activities-db`, check every row, in a planned
   window. **Ask before touching any production database.**

Later: rename `swimly-crm` to `turnfin-core` and move Work modules into their
own app the same way (optional; see architecture.md).

## 7. Resuming on another machine

- Clone `Nandui/Swimly` and check out `core-work-activities` (or `dev`), then
  run `npm ci`.
- Local: `npm run sandbox` starts Work (3100) and Activities (3102) with a
  throwaway database and fictional accounts. Use `-- --production` to test
  anything that crosses the two apps; hot reload does not pass through Work's
  address.
- `npx vercel login` to use the Vercel CLI (team `leisureworld`).
- The staged deletions of AGENTS.md / CLAUDE.md that were set aside earlier are
  in a **local** git stash on the old machine only (`stash@{0}`); they do not
  travel with the branch.
- Branch `core-work-aquatics` on GitHub is the same work under the old name;
  it can be deleted.
- Security: a password for `turnfin-activities-db` was pasted in chat on 28
  September. If it has not been reset, reset it before real data goes in.
