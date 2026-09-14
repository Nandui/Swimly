# Parent API and separate app

Backend implemented on `dev`, 14 September 2026. The parent frontend belongs in
its own repository and deployment. Swimly owns identity links, bookings and
progress data; the parent app calls this API and never connects to the database.
The API is disabled by default until the migration and configuration below are
deployed. No parent screens have been added to the staff or Instructor workspace.

## Integration contract

- Base URL: `https://<swimly-host>/api/parent/v1`.
- Machine-readable contract: [parent-api.openapi.json](parent-api.openapi.json).
- UTF-8 JSON. Request bodies are limited to 16 KiB; unknown fields are rejected.
- Authenticated calls send `Authorization: Bearer <accessToken>`.
- Do not send staff cookies, operator credentials or database credentials.
- All responses are `Cache-Control: no-store`. Clear family data on logout,
  account changes or a 401. Do not persist child records in a shared browser cache.
- Every child-specific endpoint checks the current, approved guardian link.
  Missing and unrelated child IDs both return 404.
- The browser origin must match the configured allowlist exactly. CORS supports
  `Authorization`, `Content-Type` and `Idempotency-Key`; cookies are not used.
  Server-to-server requests can omit Origin, but still need a parent token.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/request-code` | Send an email verification code; no login needed |
| POST | `/auth/verify-code` | Verify email and create/sign into a parent account |
| POST | `/auth/logout` | Revoke the current token |
| GET, PATCH | `/me` | Parent identity and contact details |
| GET | `/children` | Approved children only |
| GET | `/children/{childId}` | A linked child's basic profile |
| GET | `/children/{childId}/progress` | Released competencies, completions and assessment placements |
| GET | `/sites` | Active sites; no login needed |
| GET | `/assessment-sessions` | Published assessment availability; no login needed |
| GET | `/assessment-sessions/{sessionId}` | One open, published session; full sessions remain readable |
| GET, POST | `/assessment-bookings` | Read linked children's bookings or book an assessment |

No v1 endpoint exposes medical notes, staff notes, raw activity logs, contact
details from a swimmer record, other families, attendance registers or class
transfers. Parents cannot edit existing swimmer details, cancel bookings, or
move children between weekly classes in v1. Those policies need a later phase.

## Parent sign-in

1. `POST /auth/request-code` with `{"email":"parent@example.test"}`. The response
   is `202 {"challengeId":"…","expiresAt":"…"}`. Signup and sign-in use the same
   flow, without revealing whether an account exists.
2. Ask the parent for the six-digit email code. `POST /auth/verify-code` with
   `{"challengeId":"…","code":"123456"}`.
3. A successful response contains `accessToken`, `tokenType: "Bearer"`,
   `expiresAt` and `parent: {id,email,name,phone}`. Keep the token secret. It lasts
   seven days. There is no refresh token; request a new code after expiry.
4. If name is missing, `PATCH /me` with `{"name":"Synthetic Parent","phone":null}`
   before booking. Name is required; phone is optional. This updates the parent
   account, not contact fields on previously registered swimmers.
5. `POST /auth/logout` revokes this token. A staff account suspension revokes
   every token; reactivation cannot revive them.

Codes expire in ten minutes and allow five attempts per challenge. Codes and
tokens are stored as keyed hashes. Codes never appear in API responses or logs.
Rotating `PARENT_AUTH_SECRET` invalidates existing tokens and pending codes.
Email is verified and immutable in v1; changes to guardian email require staff
to approve the new address and revoke the old link.

For a web frontend, a small backend in the parent project can keep the bearer
token behind an HttpOnly, Secure session cookie and relay calls. That cookie is
for the parent app only. A direct browser client must keep the bearer token out
of URLs and analytics. Do not embed a shared service token in the parent app.

## Existing families and new assessment registrations

Existing swimmers need explicit staff approval of each guardian email. Approval
can happen before the parent signs up. A verified email then sees its approved
children. Matching a swimmer's name, DOB or contact email never grants access.
Multiple guardians may be approved independently for one child.

New families can browse assessments, verify their email, add their own contact
details and book without prior registration at the desk.

`GET /assessment-sessions?siteId=…&from=2026-09-14&to=2026-10-14&limit=20`
returns `{items,nextCursor}`. Dates are inclusive and cannot precede today or
span more than 90 days. Defaults are today through 90 days later. Maximum page
size is 50. Preserve filters while following an opaque `nextCursor` until null;
pages can be short or empty when sessions close or are archived during a search.
`spacesAvailable: null` means unlimited capacity; `0` means full.

Sessions must be explicitly published by staff, belong to a live site and live
curriculum, and be in the future. Booking closes at the session start, or an
earlier staff-specified cutoff. The server rechecks all of this at confirmation.
Assessment booking does not enrol a child in a weekly class or change analytics
for enrolled swimmers.

Choose one of these request bodies for `POST /assessment-bookings`:

```json
{"sessionId":"session-id","childId":"approved-child-id"}
```

```json
{
  "sessionId":"session-id",
  "newChild":{
    "firstName":"Synthetic",
    "lastName":"Swimmer",
    "dateOfBirth":"2020-01-01"
  }
}
```

Send an `Idempotency-Key` header generated once for the booking attempt, such
as a UUID. Keys accept 16–128 letters, numbers, underscores or hyphens. Retry
the exact same request with the same key after a timeout. Changing the request
requires a new key. Reusing a key with different fields returns 409. A successful
retry returns the same booking with its current status, not a second booking.

Creation responds `201 {booking:{id,childId,sessionId,status},replayed:false}`;
retries respond 200 with `replayed:true`. Keep entered details on a capacity
conflict so the parent can choose another session. Once a new child is created,
use its returned `childId` for future bookings. Creating another `newChild`
request intentionally creates another record; the API never tries to identify
an existing swimmer by personal details. Staff handle suspected duplicates.

The transaction creates the swimmer, guardian link, booking, retry record and
audit together. Failures roll them all back. Parent and staff booking use the
same AssessmentSession row lock, so there is one capacity boundary across both
apps. BOOKED and ATTENDED reserve places. Parent attribution is stored separately
from staff User IDs and is included in the staff audit log.

`GET /assessment-bookings?childId=…&limit=20` returns bookings for approved
children, including desk-created bookings. `childId` is optional; maximum page
size is 50. Follow `nextCursor` for older bookings. A cancelled session remains
visible on a child's booking with `session.cancelled: true`. Outcomes are read
from the progress endpoint, never from the live assessor record.

## Progress publication

The owner confirmed: **a competency saved Monday appears Tuesday at 00:00
Europe/Dublin**. This is next midnight, not a rolling 24 hours. Formal level
completions and assessment placements use the same release boundary so they
cannot reveal pending progress indirectly.

Database triggers append parent-safe versions of CompetencyResult,
LevelCompletion and AssessmentBooking placement changes. Their release time
uses the actual database write time, not a backdated assessment/teaching date.
Writes, removals and corrections are captured atomically with the staff change,
including older application entry points. Note-only changes do not reset the
release time. Internal notes and staff identities never enter these payloads.

The API selects the latest released version of each raw subject, then resolves
shared curriculum aliases. Pending changes preserve the previously released
state. A removal has a delayed tombstone. Several edits before midnight publish
only the final applicable state. Totals, completion markers and placements all
come from this released data; current class level comes from current enrolment.

No scheduled publication job is needed. Re-fetch progress after midnight and
when returning to the app. The response includes programme/level labels,
competencies with NOT_ASSESSED/WORKING_ON/ACHIEVED, achieved/total counts, frozen
completion totals and assessment placements. It does not expose pending counts
or a next-change timestamp. Content and curriculum descriptions are shared
definitions and are not subject to the teaching-record delay.

The migration can only backfill states that exist when installed, dated from
their current updatedAt. It does not invent earlier progress versions. All
subsequent writes and deletions retain publication history.

## Staff management API

Base: `/api/parent-admin/v1`. These endpoints use the existing staff session,
reject parent bearer tokens, and require a same-origin Origin header for writes.
They are API support for staff tools; no new management screen has been added.

`parents.manage` plus the Swimmers screen is required for family access:

| Method | Path | Body / result |
| --- | --- | --- |
| GET | `/children/{studentId}/access` | `{items}` with approved/revoked guardian emails |
| PUT | `/children/{studentId}/access` | `{email,reason}` grants or restores access |
| DELETE | `/children/{studentId}/access` | `{email,reason}` revokes access |
| GET | `/accounts?email=…` | Exact lookup; returns `{account}` or `{account:null}` |
| PATCH | `/accounts/{parentId}` | `{isActive,reason}` suspends/reactivates an account |

`courses.manage` plus the Assessments screen is required for publication.
The session must belong to the currently selected staff site:

| Method | Path | Body / result |
| --- | --- | --- |
| GET | `/assessment-sessions/{id}/publication` | `{sessionId,enabled,bookingClosesAt}` |
| PUT | `/assessment-sessions/{id}/publication` | `{enabled,bookingClosesAt?,reason}` |

Use an ISO timestamp with offset for bookingClosesAt; null means session start.
Omitting it preserves the existing value. An enabled publication requires a
future session and a future deadline no later than its start. Every change
records the staff actor and reason. Reason must contain 3–500 characters.
Administrators inherit the new permission automatically; ordinary roles need
an explicit grant. Instructor-only screen access remains isolated.

## Errors and client behaviour

Errors use `{error:{code,message}}`. Display the safe message and branch on code.

| Status | Codes / action |
| --- | --- |
| 400 | INVALID_REQUEST, INVALID_CURSOR — correct input or restart the search |
| 401 | INVALID_CODE — retry code; UNAUTHENTICATED — clear session and sign in |
| 403 | ORIGIN_DENIED or FORBIDDEN — configuration/staff-access problem |
| 404 | NOT_FOUND — missing or unapproved record |
| 405 | METHOD_NOT_ALLOWED — check the API contract; Allow names accepted methods |
| 409 | PROFILE_REQUIRED, CHILD_INACTIVE, BOOKING_CLOSED, SESSION_FULL, ALREADY_BOOKED, IDEMPOTENCY_CONFLICT |
| 413, 415 | BODY_TOO_LARGE, JSON_REQUIRED |
| 429 | RATE_LIMITED — respect Retry-After |
| 503 | UNAVAILABLE — API disabled, incomplete configuration, or email unavailable |
| 500 | INTERNAL_ERROR — retry safely; keep the booking idempotency key |

## Activation and operations

Rollout status, 14 September 2026: the additive parent migration is applied and
the parent API and Google email adapter are deployed from Swimly's `main` branch.
The owner approved production activation. Both Vercel projects are connected,
and signup/sign-in is available at `https://swimly-public-app.vercel.app`.
The Google sender is `Bookly <info@leisureworldcork.com>` with only `gmail.send`.
Its credentials are Production secrets on `swimly-crm` only. One approved code
requested through the live parent app arrived in that mailbox's Inbox; the code
was not used to create a parent account. Automated flow tests remain isolated.
See [Google email setup status](parent-google-email.md) for deployment evidence.

The custom domain, `swimschool.leisureworldcork.com`, is assigned in Vercel but
still needs a Blacknight CNAME: name `swimschool`, value
`576ddd2673884d9d.vercel-dns-016.com`. Until DNS and HTTPS work, Production's
`PARENT_APP_ORIGIN` is `https://swimly-public-app.vercel.app`. When switching the
canonical domain, update that value and redeploy the parent app; the backend
origin allowlist already includes both addresses. Leave the main website and
mail DNS records intact.

No guardian links or assessment publications were created during verification.
Existing families still need staff-approved links, and the live assessment list
is empty until staff publish sessions. The staff management API is available;
desk controls for these tasks are a separate outstanding interface task.

1. Deploy additive migration `20260914160000_parent_api` before enabling parent
   traffic. The normal production build deploys committed migrations; local or
   preview builds do not. The migration installs triggers and backfills existing
   progress, taking a short write lock on the three teaching tables. There are no
   destructive changes to staff records. Keep the tables and triggers if rolling
   back application code so new publication history remains intact.
2. Set a separate random `PARENT_AUTH_SECRET` of at least 32 characters.
3. Configure `PARENT_GOOGLE_CLIENT_ID`, `PARENT_GOOGLE_CLIENT_SECRET`,
   `PARENT_GOOGLE_REFRESH_TOKEN` and `PARENT_EMAIL_FROM` on Swimly. The approved
   sender is `Bookly <info@leisureworldcork.com>`. Follow the
   [Google Workspace email setup](parent-google-email.md) using only `gmail.send`.
   Mailbox passwords and Google domain-wide delegation are not needed.
4. Set `PARENT_API_ALLOWED_ORIGINS` to exact frontend origins, comma-separated.
   Production requires HTTPS. Development permits HTTP localhost/127.0.0.1.
   Do not put these secrets in the parent frontend repository.
5. Set `PARENT_API_ENABLED=true`, approve existing guardian links, and publish
   selected sessions. None are published automatically by the migration.

All calls have persistent request throttling; sign-in also limits each email
and IP, each code has five attempts, and bookings have a parent-specific limit.
Rate-limit state and verification/session lifecycle writes are operational
records; domain mutations carry audit rows in their transaction. No credentials
or raw codes are written to logs. Expired challenges and session rows remain
inaccessible; future retention maintenance may remove expired operational data
under an agreed policy, without deleting progress history or guardian audits.

On Vercel, IP throttling uses its supplied `x-real-ip` header (see
[request headers](https://vercel.com/docs/headers/request-headers)). Elsewhere,
the default is one conservative anonymous bucket. Only enable
`PARENT_TRUST_PROXY_IP=true` when the trusted proxy overwrites this header and
direct access to the application is blocked. The parent app must not supply
unsigned trusted forwarding headers.

The separate frontend is [swimly-public-app](https://github.com/Nandui/swimly-public-app).
It stores the parent session in an HttpOnly cookie and proxies only parent API
routes. Set the same independent `PARENT_PROXY_SECRET` (32+ random characters)
on both servers. Its server signs the Vercel-overwritten client IP using HMAC,
bound to method, path, query and a timestamp valid for 60 seconds. The API only
uses a verified signature for rate limits; it still requires the parent token
and approved guardian links. Invalid signatures fall back to normal IP limits.
Never use this key as `PARENT_AUTH_SECRET` or expose it in client code.

For isolated local review, run `PARENT_API_PREVIEW=1` with
`npx tsx scripts/parent-api-preview.ts`, then point the frontend to
`http://127.0.0.1:3019/api/parent/v1`. This script binds to loopback, creates only
in-memory synthetic records, and captures email codes locally. It does not load
the application database client or email credentials. Do not deploy the script.

Verification uses synthetic data with the actual Prisma queries and migration
chain in isolated PGlite. Tests exercise auth, permissions, cross-family access,
revocation, publication/DST boundaries, edits/removals, seat conflicts, retries,
rollback and failed email delivery. PGlite serialises transactions; it verifies
the shared SQL lock contract but is not a multi-connection PostgreSQL load test.
No real parent emails, swimmers or assessment places are used for verification.
