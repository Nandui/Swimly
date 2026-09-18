# Turnfin Docs integration

Docs opens at `/docs` from the staff portal at `/modules`, using the existing
Turnfin staff login. It is a separate workspace from Aquatics and Instructor.
The parents application is unchanged.

The implementation is adapted from `Nandui/turnfin-docs`, branch
`codex/initial-release`, commit `e11a1eb020477fb27b660ce373715ac4bf6b7624`.
The owner explicitly chose to preserve that repository's design for **Docs only**:
Inter, its ocean-blue/aqua palette, navy dark mode, sidebar, reading layouts,
authoring flow and administration screens. Module CSS and portal wrappers are
scoped to `.turnfin-docs`; shared controls come from `src/components/shadcn`.
Aquatics and the staff portal retain their existing design.

## Staff access

Administrators automatically receive Docs through `expandPermissions` and
`visibleScreens`. Other staff roles need the **Docs screen** plus a named
permission in Turnfin's existing Roles page:

| Permission | Allows |
| --- | --- |
| `docs.read` | Published documents, version history and own reading acknowledgements |
| `docs.write` | Draft creation/editing, submission, reading reports; includes reading |
| `docs.approve` | Independent approval/publication; includes authoring and reading |
| `docs.manage` | Document groups, templates, risk matrix, assignments and archiving; includes authoring and reading |

Approving requires its own permission. Docs administration alone does not
grant approval or permission to change staff accounts. Authors and every
contributor to a revision are excluded from approving it, including administrators.
Account creation, passwords, permissions and deactivation remain in Turnfin Staff
and Roles. Docs' staff directory edits only document group membership.

Page guards, server actions, reports and private downloads check the shared
session. Workflow transactions re-read the current staff grants and intersect them
with the effective session, preserving restricted role previews and revocation.

## Workflows

- Create SOP, NOP, EAP, policy, risk assessment or custom documents from editable
  structural templates. New templates contain headings, not operational guidance.
- Author rich text, tables, callouts and accessible uploaded images. Autosave is
  protected by a per-document editing lease, browser-session token and revision.
- Submit to an independent approver, request changes or publish an immutable
  version. Restore an old version into a new draft without overwriting history.
- Assign staff or teams to read each published version. A new publication creates
  fresh requirements while preserving earlier acknowledgements.
- Filter the library and reading reports; export formula-safe CSV. Archive with
  a reason while retaining historical versions and audit records.
- Configure the organisation's risk matrix before submitting risk assessments.

## Database and files

The additive migration `20260918120000_turnfin_docs` creates the `turnfin_docs`
PostgreSQL schema. Its `members` view joins existing `public."User"` and
`public."StaffRole"` records, with document memberships stored separately.
No second identity provider, password store or Supabase project is introduced.
All reads/writes use the existing `DATABASE_URL` on the server, with a
transaction-local search path so pooled connections cannot leak schema state.

Files are private and stored atomically with their metadata and audit record in
`attachment_blobs`. Downloads verify Docs access; readers cannot retrieve files
that have never appeared in a published version. PDF, DOCX, PNG, JPEG and WebP
files are checked for matching extension, MIME and signature. The upload limit
is **4 MB** to fit the deployment's request limit. Database backups must include
the Docs schema and attachment bytes. No public storage credentials are needed.

Published snapshots, review decisions, acknowledgements, files and audit events
are immutable. Every workflow mutation, including draft saves and editing-session
changes, records an audit event in the same transaction.

## Rollout

This integration does not migrate records from a separately deployed Docs service.
No source-repository demo accounts, demo documents or `.data` directory are copied.
The first rollout starts with empty document storage and six structural templates.

1. Deploy the staff app through the existing process. The production build runs
   the additive Prisma migration; do not run a seed.
2. An administrator opens Docs and configures document facilities/teams, templates
   and the risk matrix as needed.
3. Grant the Docs screen and relevant permissions to other staff roles. Use an
   independent approver for publishing.

The migration has been prepared and verified in isolated PostgreSQL; it is not
applied to the shared live database by local verification.

## Verification

Run `npm run typecheck`, `npm run lint`, and the production build with a dummy
database URL and `VERCEL_ENV=preview` to skip production migrations.

Focused checks:

```powershell
npx tsx --test src/lib/docs/*.test.ts src/lib/staff/permissions.test.ts src/lib/staff/screens.test.ts
npx tsx scripts/check-docs.mjs
```

The browser checker uses real module components and the real domain service
against an in-memory PGlite database containing fictional staff and documents.
Set `PLAYWRIGHT_MODULE` to the installed Playwright module when it is supplied
by the workspace runtime. Evidence is written under ignored
`.impeccable/review/docs`. For a synthetic preview, run
`npx tsx scripts/docs-preview/server.mjs --serve-docs` and open port 4195.
