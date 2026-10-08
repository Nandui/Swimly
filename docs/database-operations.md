# Command-line record management

`npm run db:check` verifies the secured live connection and reports the actor,
current permissions and club IDs. No browser automation or Postgres password
is required. `.vercel/swimly-operations.json` holds the private local token and
pinned endpoint; it is ignored by Git. Never print or commit it.

`npm run db:run -- .vercel/request.json` submits a private JSON request:

```json
{"operation":"students.list","clubId":"club_bishopstown","query":"SYNTHETIC-MEMBER"}
```

Available operations: `check`, `levels.list`, `courses.list`, `students.list`,
`students.get`, `courses.create`, `courses.update`, `students.create`,
`students.update`, `enrolments.create`. Lists return up to 50 rows; pass the
last returned `id` as `cursor` to continue. Get/update also need `id`.
Writes take `input` in the existing server action's format. Updates require
complete input: read existing values first. Enrolment confirmations are
returned unchanged; send `confirmation` only after user authorization.

For an active `enrolments.create`, include `input.legendAgreement`: `DONE` only
when staff confirm the billing agreement was updated in Legend, or `PENDING`
when it still needs doing. Do not infer completion from a roster or payment
balance. A waitlist does not record a completed agreement. See
[Legend agreement follow-up](legend-agreements.md).

Mutations call the existing application actions, retaining validation,
timetable site filtering, shared swimmer identity, live named permissions, seat locks, audit and revalidation.
The server loads a unique active staff account matching the configured actor
name on every request. Zero or multiple matches refuse access. Permission
changes or deactivation take effect immediately. Audits label command-line use.
The credential exposes course, swimmer and enrolment operations, not arbitrary
SQL, account administration or destructive bulk commands.

Before importing, inspect existing classes and match swimmers by member number.
Flag conflicting identities. A member found at another registration site is the
same shared record, not a reason to create a duplicate. Do not invent dates of birth
from ages or overwrite existing contacts. Keep source rosters in ignored local
files. Re-read after writes. A lost response is not permission to retry blindly.
No automatic write retries are performed.

Server configuration: `SWIMLY_OPERATIONS_TOKEN_SHA256` (SHA-256 of a random
256-bit token), `SWIMLY_OPERATIONS_ACTOR` (unique active account name), and
`SWIMLY_OPERATIONS_EXPIRES` (ISO expiry). Removing/changing the hash and deploying
revokes the token. Rotate the local token and server hash together before expiry.
Missing or expired configuration fails closed. Authentication headers and request
bodies are never logged by this route. Responses are not cached.

Use only for user-authorized tasks. Setup does not authorize unrelated changes.

## Operator scripts against production (`npm run prod`)

Scripts that need the database itself (role conversion, superadmin, copies)
run against production through one door:

    npm run prod -- scripts/convert-roles-to-levels.ts            # dry run
    npm run prod -- scripts/convert-roles-to-levels.ts --confirm

`scripts/prod.ts` reads only `.env.production.local` (ignored by Git), names the
target host and database before running, and passes the connection to the
script. Nothing else reads that file, so `npm run dev`, the sandbox and builds
cannot reach production by accident. Vercel keeps production's `DATABASE_URL`
as a sensitive variable, which `vercel env pull` cannot read, so the owner pastes
the direct (unpooled) `swimly-db` connection string from Neon into that file
once. Never print, commit or share it. The scripts stay dry runs until given
`--confirm`; read the dry run before writing.
Do not write test swimmers or classes to production.

## Previews and the development database

Work ships through a branch or pull request. Vercel builds a preview of it,
the owner checks the preview, and merging to `main` deploys production. There
is no long-lived development branch or deployment.

On the Vercel project `swimly-crm`, Preview and Development use their own Neon
database (`DATABASE_URL` and `DATABASE_URL_UNPOOLED`) and are marked
`DATABASE_ENVIRONMENT=development`. So every branch or PR preview applies the
main database's migrations to the development database, never to production.
Docs and HR migrations run only in production (`scripts/migrate-docs.ts` and
`scripts/migrate-hr.ts`). Test schema changes in the local sandbox
(`npm run sandbox`) first, and keep them additive.

On every build, `scripts/check-env.ts` and `scripts/migrate-production.ts` read
`src/lib/database-environment.ts`:
- **Production** applies committed migrations to its own database.
- **A preview marked `development`** applies them to the development database.
- **A preview without the mark** never migrates and warns. Setting
  `REQUIRE_DEV_DATABASE=true` makes it fail its build instead, and setting
  `PRODUCTION_DATABASE_HOST` to production's host name refuses a preview
  marked `development` that points at production.

Environment variables on `swimly-crm` (8 October 2026):

| Environment | Variables |
| --- | --- |
| Production | `AUTH_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `DOCS_DATABASE_URL`, `DOCS_DIRECT_URL`, `HR_DB_DATABASE_URL`, `HR_DB_DATABASE_URL_UNPOOLED`, the `PARENT_*` settings and the `SWIMLY_OPERATIONS_*` settings |
| Preview | `AUTH_SECRET`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_ENVIRONMENT`, `DOCS_DATABASE_URL`, `DOCS_DIRECT_URL` |

Previews have no HR database, so HR is switched off there. On 8 October 2026
the `swimly-dev.vercel.app` branch domain was removed, `ACTIVITIES_URL` and
`SWIMLY_DEPLOYMENT` were deleted, and so were the Neon integration's extra
`PG*`, `POSTGRES_*`, `NEON_*` and `VITE_*` variables, including their `HR_DB_`
copies. Do not add them back.

The development database starts with fictional data. Two scripts fill it from
production instead:
- `scripts/copy-staff-to-dev.ts` copies staff accounts, roles and sites only
  (owner decision, 28 September 2026).
- `scripts/copy-prod-to-dev.ts` replaces the development database's data with
  **all** of production's main database, as it is, including swimmers, parents
  and medical notes (owner decision, 29 September 2026, made knowing previews
  are less protected). It leaves out live parent sign-in tokens, keeps tables
  only the development database has, and must be followed by
  `scripts/convert-roles-to-levels.ts` against the development database. Treat
  that database, and every preview, as holding real personal data while it
  does.

Both read production in a read-only transaction, write only to a database that
already has the newer migrations, and dry-run unless given `--confirm`.

The databases (Neon, Frankfurt, attached through Vercel's Neon integration):

| Database | Holds | Attached to |
| --- | --- | --- |
| `swimly-db` | Production Core and Work (and Activities until it moves) | Work, Production |
| `turnfin-dev-db` | Development Core and Work: fictional data, plus staff, roles and sites copied from production | Work and Activities, Preview and Development |
| `turnfin-activities-db` | Production Activities, as `ACTIVITIES_*` | Activities, Production |
| `turnfin-activities-dev-db` | Development Activities, as `ACTIVITIES_*` | Activities, Preview and Development |

A new development database starts empty. The first preview build creates the
tables; then give it a way in by running `npm run db:seed` against it with
`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` set.
