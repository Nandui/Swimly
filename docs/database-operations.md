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
Do not write test swimmers or classes to production.

## A separate database for `dev`

Production and the `dev` deployment must not share a database. While they do,
only production applies migrations, and `dev` runs new code against old tables.

1. Create a Postgres database for development, for example a Neon branch or a
   Vercel Postgres database. Copy production's schema by applying the committed
   migrations. Two copies from production exist:
   - `scripts/copy-staff-to-dev.ts` copies staff accounts, roles and sites only
     (owner decision, 28 September 2026).
   - `scripts/copy-prod-to-dev.ts` replaces dev's data with **all** of production's
     main database, as it is, including swimmers, parents and medical notes (owner
     decision, 29 September 2026, made knowing the dev site is less protected).
     It leaves out live parent sign-in tokens, keeps dev-only tables such as the
     organisation, and must be followed by `scripts/convert-roles-to-levels.ts`
     against dev. Treat dev as holding real personal data while it does.
   Both read production in a read-only transaction, write only to a database
   with the dev migrations, and dry-run unless given `--confirm`.
2. On the `dev` deployment (Vercel Preview for the `dev` branch), set:
   - `DATABASE_URL` and `DIRECT_URL` to the development database (a database
     attached through Vercel's Neon integration provides `DATABASE_URL` and
     `DATABASE_URL_UNPOOLED`, which is read in place of `DIRECT_URL`);
   - `DATABASE_ENVIRONMENT=development`;
   - optionally `PRODUCTION_DATABASE_HOST` to production's host name, so a
     development deployment pointed at production is refused;
   - optionally `REQUIRE_DEV_DATABASE=true`, so any preview still sharing
     production's database fails its build instead of only warning.
3. Leave production unset, or set `DATABASE_ENVIRONMENT=production`.

On every build, `scripts/check-env.ts` and `scripts/migrate-production.ts` read
`src/lib/database-environment.ts`:
- **Production** applies committed migrations to its own database.
- **The `dev` deployment**, once marked `development`, applies them to its own
  database.
- **A deployment still sharing production's database** never migrates it and
  warns (or fails with `REQUIRE_DEV_DATABASE=true`).

The databases (Neon, Frankfurt, attached through Vercel's Neon integration):

| Database | Holds | Attached to |
| --- | --- | --- |
| `swimly-db` | Production Core and Work (and Activities until it moves) | Work, Production |
| `turnfin-dev-db` | Development Core and Work: fictional data, plus staff, roles and sites copied from production | Work and Activities, Preview and Development |
| `turnfin-activities-db` | Production Activities, as `ACTIVITIES_*` | Activities, Production |
| `turnfin-activities-dev-db` | Development Activities, as `ACTIVITIES_*` | Activities, Preview and Development |

A new development database starts empty. Its first `dev` deploy creates the
tables; then give it a way in by running `npm run db:seed` against it with
`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` set.
