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
