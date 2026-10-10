# Managing the parent app from the staff workspace

The staff interface uses the existing `/api/parent-admin/v1` endpoints with
staff cookies. It never copies parent credentials into the browser. The in-app
request workflow needs the additive `20260915170000_parent_access_requests`
migration; it needs no new environment variables.

## Where the controls live

- **Swimmers → profile → Parent access:** approve a guardian email, revoke it
  for this swimmer or restore a previous approval. Contact fields do not grant
  access. Approval sends no email. These records are shared across every site.
- **Swimmers → Parent accounts** (`/students/parents`): two panels. The first is
  a shared queue of parent access requests as rows, with a Waiting for review /
  Approved / Declined segmented filter, the shared outline Refresh button and pagination
  at the foot; waiting rows end with Decline request then Review and approve. Staff
  verify the guardian and select an existing swimmer at any site, then
  approve or decline with an internal audit reason and a separate parent-facing
  reply. Approval atomically creates/restores `ParentChildAccess` and resolves
  the request. Suspended accounts cannot be approved. Repeated decisions return
  a conflict; audit failure rolls back both the link and decision. The second
  panel is exact email lookup, the account as one row (status tag and
  suspend/reactivate in its trail). Suspension revokes existing sessions.
  Reactivation permits a fresh sign-in without restoring revoked child access.
- **Assessments → Assessment setup → Set up → Parent booking:** publish, edit a deadline,
  unpublish and refresh status. The session must belong to the working site.
  Deadlines use Europe/Dublin even on a device set to another timezone. Blank
  means the session start. Unpublishing preserves existing bookings.

Both family controls require `parents.manage` and the Swimmers screen. The
account page has its own server guard. Publication requires `courses.manage`
and Assessments. Administrators inherit these through the existing resolver;
Instructor navigation and permissions remain isolated. The server rechecks
permissions and same-origin requests on every call.

Changes require a 3–500 character reason, retain transactional audit logging,
and revalidate affected staff pages. The UI preserves failed form input and
does not automatically retry uncertain writes. Reads can be retried explicitly.
Publication status comes from the same eligibility calculation as the parent
API, including archived curriculum, deadlines, cancellations and full sessions.

The signed-in help centre includes illustrated guides for these tasks.
No real family approvals, account suspensions or assessment publications were
performed during development. A family pilot remains a separate rollout task.

## Isolated verification

`src/modules/activities/features/parents/server/admin.test.ts` uses the generated Prisma client against PGlite,
with synthetic staff authentication and records. It exercises permission and
site denial, guardian approval/revocation, account suspension, deadlines and
audit rollback. Existing parent API tests cover parent-side isolation and booking.

For a local synthetic preview, set `PARENT_ADMIN_PREVIEW=1` and run
`npx tsx scripts/parent-admin-preview.ts`. It binds to `127.0.0.1:4187` and reads
no database or email credentials. Add `?screen=accounts`, `?screen=publication`
or `?screen=directory`; `?screen=restricted` demonstrates a profile without the
parent permission. `theme=dark` selects dark appearance.

Help's guide screenshots of these controls come from the sandbox through
`scripts/help-screenshots/capture.mjs` (docs/help-centre.md), not from this preview.

Check the full parent-to-staff request flow in a branch preview with a synthetic parent account.

Roll out the staff backend and migration before deploying the parent frontend.
Development and production share a database: do not use a migration reset or seed.
