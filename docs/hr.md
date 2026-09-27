# Turnfin HR and performance

HR notes and performance reviews for the people a role covers. It is the most
sensitive part of Turnfin, so it is built with every protection the platform
access model has (docs/platform-access.md).

## Storage: a separate database

HR records live in their own Postgres database, like Docs:

- `HR_DATABASE_URL` (runtime) and optionally `HR_DIRECT_URL` (unpooled, same
  database) for migrations. Both must differ from the Turnfin and Docs databases;
  `scripts/check-env.ts` refuses a shared one.
- Schema `turnfin_hr`, migrations in `hr-database/migrations/NNN_name.sql`,
  applied in order with checksums by `scripts/migrate-hr.ts` at the end of a
  **production** build, and only when `HR_DATABASE_URL` is set.
- **Unset means HR is switched off**: the workspace says storage is not set up,
  Turnfin Me says it is not set up, and nothing else is affected.
- The HR database stores ids and the names needed to read a record later. It
  never stores permissions: who may see what is decided in the main database by
  the policy engine, and the HR queries filter by the ids it returns.

Tables: `notes`, `reviews`, `access_events` (every read) and `audit_events`
(every change, in the same transaction). Each carries `org_id` and the
subject's user id.

## Capabilities (all restricted)

| Key | Lets you |
| --- | --- |
| `hr.records.read` | Read the HR records of the people the role covers |
| `hr.notes.write` | Add and withdraw your own notes. Includes reading |
| `hr.reviews.write` | Draft reviews and share them with the person. Includes reading |

Restricted means that administrators never inherit them. They reach a person
only through a role that a superadmin created and assigned, or through the
superadmin flag. Every HR read and write also needs a **recent password**: a PIN
switch on a shared device, or a password older than 15 minutes, goes to
`/confirm-password` first. Nobody writes their own HR record.

## Who sees what

- **Notes** have a visibility:
  - **Only me**: the author and superadmins.
  - **On their record**: anyone who can read this person's HR record.
  - **Shared with them**: the same readers, and the person too.
  Withdrawn notes disappear from the record. They stay in a subject export.
- **Reviews** start as a draft only the reviewer (and superadmins) can see.
  Sharing locks the review and shows it to the person. The person acknowledges
  it, with an optional comment. Nobody else can.
- **The person** (Turnfin Me, after a fresh email code) sees only shared reviews and notes
  marked shared with them. Its home screen says only that a review is waiting,
  never the content.
- **Superadmins** see "Who read what", the read and change logs (`/hr/activity`).
  They can also export everything held about a person's employment as one JSON
  file (`/hr/people/{id}/export`): profile, training, qualifications and the whole
  HR record, including the read log. The export is itself logged.

## Files

- Storage: `src/lib/hr/storage-config.ts`, `database.ts`, `scripts/lib/hr-storage.ts`, `scripts/migrate-hr.ts`
- Access and reads: `src/lib/hr/access.ts`, `records.ts` (workspace, logged), `mine.ts` (the person's own)
- Writes: `src/lib/hr/actions.ts`; export: `src/lib/hr/export.ts`
- UI: `src/app/hr/`, `src/components/hr/`; the person's side is Turnfin Me (`apps/me`)
- Tests: `src/lib/hr/hr.test.ts` (with `src/test/hr-database.ts`)

## Turning it on

1. Provision a separate Postgres database for HR.
2. Set `HR_DATABASE_URL` (and `HR_DIRECT_URL` if the runtime URL is pooled) in
   the production environment.
3. Deploy. The build applies `hr-database/migrations`.
4. As a superadmin, create a restricted HR role (for example **HR lead**, with
   `hr.notes.write` and `hr.reviews.write` and the HR screen) and assign it with a
   scope: a site, a department, or the holder's own reports.
