# Turnfin 2.0: operations

Running Turnfin: environments, databases, deploying, scheduled jobs, every setting, the sandbox and the secured record-management workflow. The databases' place in the design is in [architecture.md](architecture.md#databases).

## Environments

| Environment | Built from | Main database | Notes |
| --- | --- | --- | --- |
| **Production** | `main`, by Vercel (project `swimly-crm`, region `fra1`) at `https://turnfin.app` | `swimly-db` (Neon, Frankfurt) | migrates the main, Docs and HR databases on build |
| **Preview** | every branch and pull request | `swimly-db`'s branch `preview` | migrates only the development database; HR is off |
| **Development** | your machine, `npm run dev` | your `.env` | |
| **Sandbox** | your machine, `npm run sandbox` | throwaway in-memory databases | fictional data; start here |

There is no long-lived development branch. Changes ship as a branch or pull request, the owner checks its preview, and merging to `main` deploys production.

**Treat every preview as holding real personal data.** The `preview` branch is a copy of production made on 20 October 2026, contact details and medical notes included (owner decision, knowing previews are less protected), and a preview can email real people.

## Running it locally

Node.js 24. `npm ci` installs and generates the Prisma client.

- **Sandbox:** `npm run sandbox`, then `http://localhost:3100`. Six fictional people, one per role (superadmin, duty manager, swim school manager, instructor, receptionist, lifeguard), with synthetic swimmers, classes at two sites, training, HR notes and a rota (`scripts/sandbox-seed.ts`). The password and PIN are in `scripts/sandbox.mts`. It never reads real settings.
- **Your own database:** copy `.env.example` to `.env`, set `DATABASE_URL` and `AUTH_SECRET`, run `npm run dev`. On a new, empty database: `npm run db:deploy`, set `SEED_ADMIN_*`, `npm run db:seed` for the first account, then clear those settings.
- **Turnfin Me and the Academy site** run from `apps/me` and `apps/academy` with their own `npm run dev`; in development their sign-in codes print to the console (`STAFF_EMAIL_DEV_LOG`, `ACADEMY_EMAIL_DEV_LOG`).

| Command | Purpose |
| --- | --- |
| `npm run sandbox` | Turnfin on throwaway databases with fictional data |
| `npm run dev` | development server against your `.env` |
| `npm run typecheck` | Next.js type generation and TypeScript |
| `npm run lint` | ESLint (boundary and UI rules) and `scripts/lint/ui-rules.mjs` |
| `npm test` | the test suite (`node --test` through `tsx`), with isolated database and sign-in doubles |
| `npm run build` | what Vercel runs: check settings, migrate, generate the client, build |
| `npm run db:migrate` | create and apply a migration on an isolated database |
| `npm run db:deploy` | apply committed migrations to the configured database |
| `npm run db:seed` | the first administrator in a new database |
| `npm run db:seed-curriculum` | an optional starter curriculum for a new database |
| `npm run db:studio` | Prisma Studio |
| `npm run db:check`, `npm run db:run` | the secured record-management workflow (below) |
| `npm run prod` | operator scripts against production (below) |

## Migrations

- **Only add.** Merging to `main` migrates production under live code. A rename or removal goes in steps: add the new one, move the code, remove the old one in a later release, with the owner's yes.
- Test schema changes in the sandbox first.
- On every build, `scripts/check-env.ts` and `scripts/migrate-production.ts` read `src/lib/database-environment.ts`:
  - production applies committed migrations to its own databases;
  - a preview marked `DATABASE_ENVIRONMENT=development` applies main-database migrations to the development database;
  - a preview without the mark never migrates and warns; `REQUIRE_DEV_DATABASE=true` makes it fail instead, and `PRODUCTION_DATABASE_HOST` refuses a preview marked development that points at production.
- Docs and HR migrations run only in production (`scripts/migrate-docs.ts`, `scripts/migrate-hr.ts`).
- **Never rename or edit a migration once its branch is pushed.** Previews have already applied it, the renamed copy fails, and Prisma then refuses every later preview (P3009). To recover, mark the failed one rolled back on the development database (`prisma migrate resolve --rolled-back <name>`) and push again.
- If previews cannot reach their database (P1001), the build finishes but pages fail: check the `preview` branch in Neon and that Preview's `DATABASE_URL` and `DATABASE_URL_UNPOOLED` point at it.

**Refreshing the development database** (both read production in a read-only transaction, write only to a database already at production's migrations, and are dry runs until `--confirm`):
- `scripts/copy-staff-to-dev.ts`: staff accounts, roles and sites only.
- `scripts/copy-prod-to-dev.ts`: all of production's main database, without live parent sign-in tokens.

A brand-new development database starts empty: the first preview build creates the tables; then run `npm run db:seed` against it with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.

## Scheduled jobs

In `vercel.json`, times in UTC, each guarded by `CRON_SECRET`:

| Path | When | Does |
| --- | --- | --- |
| `/api/cron/tasks` | 01:30 | makes yesterday's and today's tasks at every site and freezes yesterday's score |
| `/api/cron/training` | 05:30 | runs every training rule: assigns courses to people who never finished them or are due again |
| `/api/cron/incidents` | 06:00 | reminds each owner of an incident action due tomorrow or overdue |
| `/api/cron/reminders` | 07:00 | each person's daily digest from Turnfin Me |

## Settings

Set in Vercel per environment; locally in `.env` (copy `.env.example`). Secrets are at least 32 random characters, each one its own. Never print or commit a value.

**The core**

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | the main database (pooled) |
| `DATABASE_URL_UNPOOLED` or `DIRECT_URL` | the same database, unpooled, for migrations; required when `DATABASE_URL` is set |
| `DATABASE_ENVIRONMENT` | `development` on Preview and Development, so builds migrate the development database |
| `REQUIRE_DEV_DATABASE`, `PRODUCTION_DATABASE_HOST` | make a misconfigured preview fail rather than warn or touch production |
| `AUTH_SECRET` | signs staff sessions |
| `AUTH_TRUST_HOST` | `true` behind a proxy or on a host Auth.js cannot infer |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Sign in with Google (Production only: previews' addresses change). Redirect URI `https://<host>/api/auth/callback/google` |
| `AUTH_GOOGLE_DOMAINS` | work domains whose Google accounts may get a new account (default `leisureworldcork.com`) |
| `WORK_DEVICE_REQUIRED` | when `true`, signing in away from a registered work device needs `work.anywhere` |
| `DEV_AUTH_BYPASS` | `1` signs in as the first active admin; ignored in production |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` | the first account, for `npm run db:seed` only; clear afterwards |
| `CRON_SECRET` | guards the scheduled jobs |

**Docs and HR**

| Setting | Purpose |
| --- | --- |
| `DOCS_DATABASE_URL`, `DOCS_DIRECT_URL` | Docs' own database; never the main one |
| `DATABASE_POOL_MAX` | optional: the most connections each database pool opens. Leave unset; the sandbox sets it to 1 |
| `HR_DATABASE_URL`, `HR_DIRECT_URL` (or Vercel's `HR_DB_DATABASE_URL`, `HR_DB_DATABASE_URL_UNPOOLED`) | HR's own database; unset, HR is off |

**Email and files**

| Setting | Purpose |
| --- | --- |
| `TURNFIN_EMAIL_FROM`, `TURNFIN_GOOGLE_CLIENT_ID`, `TURNFIN_GOOGLE_CLIENT_SECRET`, `TURNFIN_GOOGLE_REFRESH_TOKEN` | the platform's one sender (Gmail API, send-only scope); unset, it falls back to the `PARENT_*` sender |
| `REFUNDS_APP_URL`, `COINAGE_APP_URL` | Turnfin's address for links in Refunds and Coinage emails |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob, for Incidents footage; unset, uploads are off |
| `ANTHROPIC_API_KEY` | Training's course drafting with Claude; unset, it is off |
| `INCIDENTS_EMAIL_DEV_LOG` | development only: print footage request emails instead of sending them |

**Turnfin Me** (`apps/me`)

| Setting | Where | Purpose |
| --- | --- | --- |
| `STAFF_API_ENABLED` | Turnfin | `true` turns on `/api/staff/v1` |
| `STAFF_AUTH_SECRET` | Turnfin | signs Turnfin Me sessions |
| `STAFF_API_ALLOWED_ORIGINS` | Turnfin | Turnfin Me's exact origin |
| `STAFF_ME_URL` | Turnfin | Turnfin Me's address, for email links |
| `STAFF_EMAIL_DEV_LOG` | Turnfin, development | print sign-in codes instead of emailing |
| `NEXT_PUBLIC_STAFF_API_URL` | Turnfin Me | `https://<turnfin-host>/api/staff/v1` |

**Parent app** (separate repository)

| Setting | Purpose |
| --- | --- |
| `PARENT_API_ENABLED` | `true` turns on `/api/parent/v1` |
| `PARENT_AUTH_SECRET` | signs parent sessions and codes; rotating it signs everyone out |
| `PARENT_API_ALLOWED_ORIGINS` | the parent app's exact origins, comma-separated |
| `PARENT_GOOGLE_CLIENT_ID`, `PARENT_GOOGLE_CLIENT_SECRET`, `PARENT_GOOGLE_REFRESH_TOKEN`, `PARENT_EMAIL_FROM` | the parent app's sender |
| `PARENT_TRUST_PROXY_IP`, `PARENT_PROXY_SECRET` | trust the client address from the parent app's proxy, which proves itself with this secret |
| `PARENT_API_PREVIEW`, `PARENT_ADMIN_PREVIEW`, `PARENT_ADMIN_PORT` | isolated local previews of the parent and staff-control APIs; refused in production |

**Academy booking site** (`apps/academy`)

| Setting | Where | Purpose |
| --- | --- | --- |
| `ACADEMY_API_ENABLED` | Turnfin | `true` turns on `/api/academy/v1` |
| `ACADEMY_AUTH_SECRET` | Turnfin | signs booking sessions; its own secret |
| `ACADEMY_API_ALLOWED_ORIGINS` | Turnfin | the site's exact origin |
| `ACADEMY_SITE_URL` | Turnfin | the site's address for email links (defaults to the first allowed origin) |
| `ACADEMY_EMAIL_NAME` | Turnfin | the name its emails show |
| `ACADEMY_EMAIL_DEV_LOG` | Turnfin, development | print booking codes instead of emailing |
| `NEXT_PUBLIC_ACADEMY_API_URL`, `NEXT_PUBLIC_ACADEMY_NAME` | the site | the API address and the name it shows |

**Operations and the sandbox**

| Setting | Purpose |
| --- | --- |
| `SWIMLY_OPERATIONS_TOKEN_SHA256`, `SWIMLY_OPERATIONS_ACTOR`, `SWIMLY_OPERATIONS_EXPIRES` | the record-management route (below) |
| `SANDBOX_PASSWORD`, `SANDBOX_PORT`, `SANDBOX_DB_PORT` | override the sandbox's defaults |

`.env.example` must list every setting above that a developer may set; keep it in step in the same change.

## Record management from the command line

For record work the user has authorised, without a browser or a Postgres password.

- `npm run db:check` verifies the secured connection and reports the actor, their permissions and site ids.
- `npm run db:run -- .vercel/request.json` sends a private JSON request, such as `{"operation":"students.list","clubId":"…","query":"SYNTHETIC-MEMBER"}`. Operations: `check`, `levels.list`, `courses.list`, `students.list`, `students.get`, `courses.create`, `courses.update`, `students.create`, `students.update`, `enrolments.create`. Lists return up to 50 rows; pass the last `id` as `cursor`.
- Writes take `input` in the server action's format and need complete input, so read first. `enrolments.create` first returns a confirmation; send it back only after the user authorises it. An active enrolment includes `input.legendAgreement`: `DONE` only when staff confirm the Legend billing agreement was updated, otherwise `PENDING`.
- Every request runs the app's own actions (validation, site filtering, permissions, locks, audit), as one unique active staff account named by `SWIMLY_OPERATIONS_ACTOR`. Audit rows say it came from the command line. It exposes no SQL, account administration or bulk deletion.
- The local token and pinned endpoint are in the ignored `.vercel/swimly-operations.json`. **Never print or commit it**, never use computer control for this workflow, and never ask for a Postgres password while it works. Rotate the token and the server's hash together before `SWIMLY_OPERATIONS_EXPIRES`; missing or expired configuration fails closed.
- Before importing: match swimmers by member number, flag conflicting identities, never invent dates of birth or overwrite contacts, keep source rosters in ignored local files, re-read after writing. A lost response is not permission to retry.

## Operator scripts against production

`npm run prod -- <script>` runs a script against production through one door: `scripts/prod.ts` reads only the ignored `.env.production.local` (the owner pastes the unpooled `swimly-db` connection string there once), names the target before running, and passes the connection on. Scripts are dry runs until `--confirm`; read the dry run first. Examples: `scripts/convert-roles-to-levels.ts`, `scripts/grant-superadmin.ts`.

Never run migrations, seeds, imports or test writes against a real database to inspect or test the app, and never write test records to production. Keep real swimmer names, contacts and medical notes out of exports, artifacts and screenshots.
