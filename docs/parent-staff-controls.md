# Managing LeisureWorld Aquatics from the staff workspace

The staff interface uses the existing `/api/parent-admin/v1` endpoints with
staff cookies. It never copies parent credentials into the browser. No database
migration or new environment setting is required.

## Where the controls live

- **Swimmers → profile → Parent access:** approve a guardian email, revoke it
  for this swimmer or restore a previous approval. Contact fields do not grant
  access. Approval sends no email. These records are shared across both sites.
- **Swimmers → Parent accounts** (`/students/parents`): exact email lookup,
  account details and suspend/reactivate. Suspension revokes existing sessions.
  Reactivation permits a fresh sign-in without restoring revoked child access.
- **Assessments → session → Booking in LeisureWorld Aquatics:** publish, edit a deadline,
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

The signed-in help centre includes three illustrated guides for these tasks.
No real family approvals, account suspensions or assessment publications were
performed during development. A family pilot remains a separate rollout task.

## Isolated verification

`src/lib/parent/admin.test.ts` uses the generated Prisma client against PGlite,
with synthetic staff authentication and records. It exercises permission and
site denial, guardian approval/revocation, account suspension, deadlines and
audit rollback. Existing parent API tests cover parent-side isolation and booking.

For a local synthetic preview, set `PARENT_ADMIN_PREVIEW=1` and run
`npx tsx scripts/parent-admin-preview.ts`. It binds to `127.0.0.1:4187` and reads
no database or email credentials. Add `?screen=accounts`, `?screen=publication`
or `?screen=directory`; `?screen=restricted` demonstrates a profile without the
parent permission. `theme=dark` selects dark appearance.

Run `npx tsx scripts/check-parent-admin.mjs` for the isolated browser workflow
and the 375, 768, 1024 and 1280px light/dark checks. If Playwright is provided by
the workspace runtime, set `PLAYWRIGHT_MODULE` to its `playwright/index.mjs`.
The script creates its own loopback server and closes it afterwards. Review
captures are stored under ignored `.impeccable/review/parent-admin`.
Add `--write-help-images` to refresh the three committed guide screenshots after
the checks pass.
