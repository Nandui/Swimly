# Turnfin Docs integration

Docs opens at `/docs` from the staff portal at `/modules`, using the existing
Turnfin staff login. It is a separate workspace from Aquatics and Instructor.
The parents application is unchanged.

The implementation is adapted from `Nandui/turnfin-docs`, branch
`codex/initial-release`, commit `e11a1eb020477fb27b660ce373715ac4bf6b7624`.
Docs keeps that repository's sidebar, reading layouts, authoring flow and
administration screens. Since September 2026 its colours and type follow the
**Poolside Clear** design shared with Refunds: Plus Jakarta Sans, the fin's teal
and aqua, a cool canvas with white panels and a pool-night dark mode, defined in
`src/app/docs/poolside.css`. Module CSS and portal wrappers are scoped to
`.turnfin-docs`; shared controls come from `src/components/shadcn`.
Aquatics and the general staff portal retain their existing design. The Reception
Portal keeps the earlier Docs theme (Inter, ocean blue) through `brand.css`; it does
not load `poolside.css`. See docs/reception-portal.md.

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
session. Workflow operations re-read current staff grants from Turnfin and intersect
them with the effective session, preserving restricted role previews and revocation.
Staff identities and permissions are not replicated into Docs. The two databases
cannot share a transaction: authorization is checked before Docs writes, and Docs
changes and their audit records commit together. If Turnfin is unavailable, Docs
fails closed rather than using cached grants.

## Workflows

- Create SOP, NOP, EAP, policy, risk assessment or custom documents from editable
  structural templates. New templates contain headings, not operational guidance.
- Author rich text, tables, callouts and accessible uploaded images. Autosave is
  protected by a per-document editing lease, browser-session token and revision.
  The sticky toolbar supports H1–H6, font sizes, text colour, highlighting,
  bold/italic/underline/strikethrough, subscript/superscript, alignment, nested
  lists and checklists, quotes, code, links, dividers and table editing (including
  headers and merged cells). Clear formatting and undo/redo are available.
  Formatting persists in drafts and immutable publications; reader checklists
  display the saved state without changing the approved document. Toolbar rows
  scroll horizontally on narrow screens without widening the page.
- Submit to an independent approver, request changes or publish an immutable
  version. Restore an old version into a new draft without overwriting history.
- Assign staff or teams to read each published version. A new publication creates
  fresh requirements while preserving earlier acknowledgements.
- Filter the library and reading reports; export formula-safe CSV. Archive with
  a reason while retaining historical versions and audit records.
- Configure the organisation's risk matrix before submitting risk assessments.

## Database and files

Docs uses a **separate PostgreSQL database**, configured with server-only
`DOCS_DATABASE_URL` (pooled runtime connection) and `DOCS_DIRECT_URL` (unpooled
migration connection). Turnfin/Aquatics retains `DATABASE_URL` and `DIRECT_URL`.
Missing Docs configuration fails closed; there is no fallback to Aquatics storage.
The build rejects connections pointing both modules at the same database.

`docs-database/migrations/001_documents.sql` owns the dedicated `turnfin_docs`
schema. Documents reference shared staff IDs as text, validated through the live
Turnfin directory before mutations. Facilities/team memberships belong to Docs;
names, emails, account activity and grants are read from Turnfin when needed.
There is no second identity provider or password store. A transaction-local search
path prevents schema state leaking between pooled connections.

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

No source-repository demo accounts, demo documents or `.data` directory are copied.
The separate-database rollout preserves all Docs content from the original shared
`turnfin_docs` schema. It does not import an unrelated standalone Docs service.

1. Set both Docs connection secrets in the Vercel staff project. Keep the existing
   Turnfin connections unchanged. For local development use ignored `.env.local`.
2. Deploy through the existing process. After the application compiles, the final
   production build step runs `scripts/migrate-docs.ts`; do not run a seed.
   It initializes the dedicated schema, prevents further writes to the old Docs
   tables, then transfers only Docs data and verifies every table's row count and
   content digest, including attachment bytes.
   Documents, versions, drafts, membership, reading records, audit history and
   attachment bytes retain their IDs and timestamps. Credentials and other module
   data are never copied. During the short cutover, old Docs clients may need to
   refresh after the deployment becomes ready.
3. An administrator opens Docs and configures document facilities/teams, templates
   and the risk matrix as needed.
4. Grant the Docs screen and relevant permissions to other staff roles. Use an
   independent approver for publishing.

Copy operations and the import marker commit atomically. Retrying a deployment
does not overwrite newer destination records; mismatched source/destination
markers or a non-empty unimported destination stop the migration. The old Docs
schema remains intact and read-only for recovery. Do not roll back to a build
that writes there or remove the old-write guard; roll forward using the dedicated
database. If a cutover fails after freezing the old schema, fix the reported issue
and rerun the same deployment. Do not delete or reset either database.

The original Prisma migration remains unchanged in its applied history. All
future Docs schema migrations belong in `docs-database`, never in the Aquatics
Prisma schema. Verification uses two isolated PGlite databases and no live writes.

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
