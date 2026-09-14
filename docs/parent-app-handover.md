# Parent app handover — 14 September 2026

Both apps are deployed to Vercel Production and connected. Parent sign-in email
works through Google Workspace. Deployment is complete; preparing family access,
publishing assessments and connecting the custom domain remain rollout tasks.
This is the verified end-of-session snapshot. Check for newer commits and live
settings before continuing; the code references below precede this handover.

## Where everything lives

| App | Repository and working branch | Vercel project | Production URL | Last verified production commit |
| --- | --- | --- | --- | --- |
| Staff and parent API | [Nandui/Swimly](https://github.com/Nandui/Swimly), `dev` for work, `main` for production | `swimly-crm` | [Staff app](https://swimly-lw.vercel.app) | `e1a61f9d` |
| Parent interface | [Nandui/swimly-public-app](https://github.com/Nandui/swimly-public-app), `main` | `swimly-public-app` | [Parent app](https://swimly-public-app.vercel.app) | `09cf41e` |

Both Vercel projects belong to the **LeisureWorld** team (`leisureworld`).
The parent repository also has a [resume note](https://github.com/Nandui/swimly-public-app/blob/main/docs/handover.md).
The staff app owns the database, identity approval, capacity, audit and progress
publication. The separate parent app accesses them only through the parent API.

## Completed and verified

- The additive parent database migration is applied. The API is enabled in
  Production, and the parent frontend is connected to it.
- Google Cloud project **Bookly Parent Email** (`bookly-parent-email`) has the
  Gmail API, an Internal OAuth app and the existing mailbox's authorization.
  Sender: **Bookly <info@leisureworldcork.com>**. Only `gmail.send` was granted.
  Do not repeat registration or mailbox authorization just to resume work.
- Google credentials and independent parent authentication/proxy signing
  secrets are saved in Vercel. They are deliberately absent from GitHub.
- Both production deployments were READY. Public site reads succeeded through
  the backend and frontend proxy, returning two sites. Public assessment reads
  succeeded and returned **zero published sessions**.
- One owner-approved sign-in code was requested through the live parent app.
  The code-entry screen appeared and delivery to the sender mailbox's Inbox was
  verified at approximately **23:41 Europe/Dublin on 14 September 2026**.
  The code was not submitted: this check did **not** create a parent account.
- Unauthenticated child reads returned 401; an unapproved origin returned 403.
  Private/no-store response headers were checked. No runtime errors were found
  in either project's release window.

No swimmers, guardian links, assessment publications or bookings were created
in production for verification. Existing family access still needs explicit
staff approval, and assessment booking needs published sessions.

## Next work

### 1. Connect the custom domain

[Vercel's parent project domains](https://vercel.com/leisureworld/swimly-public-app/settings/domains)
already contains **swimschool.leisureworldcork.com**. At the last check, the
required CNAME was missing. Add this record in the company's **Blacknight DNS**:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `swimschool` | `576ddd2673884d9d.vercel-dns-016.com` |

Confirm the required value in Vercel before saving. Leave the main website's
apex/www records, nameservers and mail records unchanged.

After Vercel validates DNS and HTTPS:

1. Set the parent project's **Production** `PARENT_APP_ORIGIN` to
   `https://swimschool.leisureworldcork.com`.
2. Redeploy the parent project and verify sign-in and same-origin requests on
   the custom domain. Both addresses are already in the backend allowlist.
3. Consider redirecting the default Vercel address to the new canonical domain
   so users do not submit forms from the old origin. This is not implemented.

Until then, use **https://swimly-public-app.vercel.app**. DNS work does not block
development of the staff controls below.

### 2. Build the staff controls for parent access and assessment publishing

The management API exists; the desk interface for it has **not** been built.
The next coding task is to add controls in the staff app for:

- Approving/revoking a guardian email's access from a swimmer profile.
- Looking up and suspending/reactivating a parent account.
- Publishing/unpublishing assessment sessions and setting a booking deadline.

Use the existing [staff management API contract](parent-app.md#staff-management-api)
and [implementation](../src/lib/parent/admin.ts). Base path:
`/api/parent-admin/v1`. Family access requires `parents.manage` and the Swimmers
screen; publication requires `courses.manage` and the Assessments screen.
Writes use staff sessions, same-origin checks and an audit reason. Administrators
inherit permissions through the existing permission system. Keep these controls
out of the parent app and the isolated Instructor workspace.

### 3. Run an approved family pilot

When the staff controls are ready, arrange an owner-approved pilot: link a real
family to the correct swimmer, publish a suitable future assessment session,
and verify sign-in, released progress and the new-family assessment flow.
No real family pilot or live booking has been completed yet. Do not create test
children/bookings in the shared database or send further test emails without
explicit authorization; use the isolated fixtures for development checks.

## Product decisions to preserve

- Competencies flagged on Monday become visible **Tuesday at 00:00
  Europe/Dublin**, not after a rolling 24-hour delay. Previously released
  progress remains visible until the next release boundary.
- Existing swimmers are linked by staff approval of a guardian email. Never
  automatically match children by name, date of birth or contact details.
- A new family can verify its email and book an assessment for a child not yet
  in the system. The API creates the child, guardian access and booking together.
- Parents see only approved children and released progress; no medical notes,
  internal staff notes or raw audit logs are exposed.
- Parent class moves/transfers are future work. Booking cancellation and parent
  email changes are also outside v1.
- Email currently sends sign-in codes. Assessment confirmations appear in
  **My bookings**; a separate confirmation email is not implemented.

## Resume on another PC

1. Clone or pull both repositories, preferably into sibling folders. Read each
   repository's `AGENTS.md` and README. Use current remote branches, not a saved
   local build. Staff work continues on `dev`; the parent repo uses `main`.
2. Install dependencies with `npm ci` in each checkout. Node.js 24 was used for
   the verified workspace. For the parent interface, use the isolated preview
   instructions in the [parent README](https://github.com/Nandui/swimly-public-app#isolated-preview-and-integration-check).
3. In the staff checkout, start the in-memory API (PowerShell):

   ```powershell
   $env:PARENT_API_PREVIEW = '1'
   npx tsx scripts/parent-api-preview.ts
   ```

4. In the parent checkout, configure ignored `.env.local` with:

   ```dotenv
   SWIMLY_API_URL=http://127.0.0.1:3019/api/parent/v1
   PARENT_APP_ORIGIN=http://127.0.0.1:3020
   PARENT_PREVIEW_MODE=true
   ```

   Start `npm run dev` and open `http://127.0.0.1:3020`. The synthetic family is
   `parent@example.test`; its local code is available from
   `http://127.0.0.1:3019/__test/code?email=parent@example.test` after requesting it.
   These endpoints exist only in the isolated preview, not in production.

The synthetic workflow needs no Google or production database credentials.
Running the full staff app requires its approved local environment setup; see
the [staff README](../README.md#local-development). Development and production
share a database: do not seed, import or mutate it to inspect/test the app.

Company account access to Vercel, Google Cloud and Blacknight is needed only
when working on those services. Google secrets belong solely to the staff
project's Production environment. Do not copy them into the parent app, local
preview configuration, GitHub or chat.

## Configuration reference

| Project / Production | Configured settings |
| --- | --- |
| Staff `swimly-crm` | `PARENT_API_ENABLED=true`; `PARENT_AUTH_SECRET`; `PARENT_PROXY_SECRET`; `PARENT_GOOGLE_CLIENT_ID`; `PARENT_GOOGLE_CLIENT_SECRET`; `PARENT_GOOGLE_REFRESH_TOKEN`; `PARENT_EMAIL_FROM` |
| Staff allowed origins | `https://swimly-public-app.vercel.app,https://swimschool.leisureworldcork.com` in `PARENT_API_ALLOWED_ORIGINS` |
| Parent `swimly-public-app` | `SWIMLY_API_URL=https://swimly-lw.vercel.app/api/parent/v1`; `PARENT_APP_ORIGIN=https://swimly-public-app.vercel.app`; matching `PARENT_PROXY_SECRET` |

Authentication and proxy signing secrets are distinct. Google values exist
only on staff Production; parent connection entries have separate Production
and Preview scopes. Preserve that separation. Detailed setup and recovery:
[Google Workspace email](parent-google-email.md) and [parent API](parent-app.md).

## Verification already completed

For the email/API rollout, staff `npm run typecheck` and `npm run lint` passed.
The focused `email.test.ts` and `api.test.ts` run passed **19 tests**. The isolated
parent integration check passed sign-in, profile, guardian isolation, CSRF,
new-child booking, retry and logout. Both Vercel production builds succeeded.
The live checks and their limits are recorded above; a full real-family flow
was not tested in production. This handover itself changes documentation only.
