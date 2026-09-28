# Turnfin Work and Turnfin Me

*Owner decision, 27 September 2026.*

Staff use Turnfin in two ways, and each has its own app.

- **Turnfin Work** (this app) is the job, done on the centre's registered PCs:
  Aquatics, Reception, Refunds, Docs, and the manager screens for Training, HR
  and Rota. It has **no personal pages or data**: no My hub, no "my training",
  no shared HR records. `/` opens the person's role home.
- **Turnfin Me** (`apps/me`) is the person's own records, on their own phone:
  - training to complete;
  - required reading (Docs acknowledgements happen only here);
  - qualifications, including uploading a new certificate;
  - shifts;
  - what HR shared with them;
  - their own contact details;
  - reminder preferences.

  It is a separate app with its own deployment and address. It never connects
  to a database: it only calls the **staff API** (`/api/staff/v1` on Work).

The split is enforced by what each side can reach, not by devices:

- Work serves no personal endpoints.
- The staff API returns only the caller's own records, through allowlists. It
  never returns swimmers, refunds, other staff or permissions.

## Working on work PCs

Work PCs are the devices registered under **Staff → Work devices**. When
`WORK_DEVICE_REQUIRED=true`, a password sign-in to Work on any other browser
needs a role with **Can work away from the centre's computers** ticked (it
gives `work.anywhere`):

- give it to roles such as duty managers;
- administrators inherit it;
- superadmins always pass.

Anyone else sees: "This account can only sign in to Turnfin Work on a work
computer." The rule is off by default. Register the centre's PCs before
turning it on.

## Signing in to Turnfin Me

- **An email code every time**, sent to the email on the person's Turnfin
  account. There is no password.
  - Codes last 10 minutes, are single-use, and allow five wrong tries.
  - They are rate-limited per address and per IP.
  - The response never says whether an address has an account.
- **Sessions last up to 12 hours.** The app keeps the token in the open tab
  only (`sessionStorage`), so closing it means a new code next time. Tokens and
  codes are stored hashed.
- **HR records need a fresh code** on top of the session (`auth/confirm`), valid
  for 15 minutes.
- **Deactivating** an account, or removing it from the organisation, ends all
  its sessions at once.

## Staff API contract (`/api/staff/v1`)

- JSON only. Bodies are limited to 16 KiB; certificate uploads to about 7 MiB
  of base64.
- `Authorization: Bearer <token>`; no cookies.
- Browser origins must be listed in `STAFF_API_ALLOWED_ORIGINS`.
- Responses are `no-store`.
- Errors are `{ error: { code, message } }`. Codes include:
  - `UNAUTHENTICATED` (401, sign in again);
  - `CONFIRM_REQUIRED` (403, HR needs a fresh code);
  - `NOT_FOUND`, which is also returned for other people's records;
  - `NOT_POSSIBLE` (409);
  - `RATE_LIMITED` (429).

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `auth/request-code` | `{ email }`. Emails a code to active staff only. Always 202 |
| POST | `auth/verify-code` | `{ challengeId, code }`. Returns `{ accessToken, expiresAt, me }` |
| POST | `auth/confirm` | Sends a fresh code for HR (session required) |
| POST | `auth/confirm/verify` | `{ challengeId, code }`. HR opens for 15 minutes |
| POST | `auth/logout` | Ends the session |
| GET | `home` | Open training, outstanding reading, expiring qualifications, the next shifts, and a count of reviews to acknowledge (no HR content) |
| GET, PATCH | `me` | Profile and own details. PATCH proposes phone, address or emergency contact changes; the record changes only after review on Work. One request is waiting at a time |
| GET | `qualifications` | The newest certificate of each type, uploads and their status, and the qualification types |
| POST | `qualifications/evidence` | Upload a PDF, PNG or JPEG (up to 5 MB, checked by file signature) for someone to check |
| GET | `training`, `training/{id}` | Own training, with the course material |
| POST | `training/{id}/complete` | `{ note }`. A practical course waits for a trainer; anything else completes and records any qualification it grants |
| GET | `reading`, `reading/{documentId}` | Assigned required reading only; the published body is Tiptap JSON |
| POST | `reading/{documentId}/acknowledge` | `{ versionId }` |
| GET | `shifts?days=28` | Own shifts, with any qualification warning |
| GET | `hr` | Needs confirmation. Shared notes and reviews only. The read is logged |
| POST | `hr/reviews/{id}/acknowledge` | `{ comment }`. Needs confirmation |
| GET, PUT | `notifications` | Reminder preferences |

## Review queues on Work

- **Staff → Details changes** (`staff.manage`). Apply or decline a person's own
  details change. Nobody reviews their own. The audit names the fields, never
  the values.
- **Training → Certificates to check** (`qualifications.manage` for that
  person, through the policy engine). Open the file, then record it (which adds
  the qualification, verified by you, with the type's validity if no expiry is
  given) or decline it with a reason the person sees. Never your own.

## Reminders

A daily cron (`/api/cron/reminders`, 07:00 UTC, `CRON_SECRET`) sends each person
one digest of new items only:

- training due within 3 days, or overdue;
- a qualification crossing 60, 30 or 7 days, or expired (not once renewed);
- overdue required reading.

Each item is logged in `StaffReminderLog`, so it is never repeated. Shift
changes (added, changed, reassigned or cancelled) email the people affected
straight away. People turn each kind off in Turnfin Me. Emails never contain HR
content.

## Configuration

Work (the Swimly app):
- `STAFF_API_ENABLED=true`
- `STAFF_AUTH_SECRET` (32+ characters)
- `STAFF_API_ALLOWED_ORIGINS` (the Me app's origin)
- `STAFF_ME_URL` (where emails link)
- `STAFF_EMAIL_FROM` (optional; the Google sender falls back to `PARENT_*`)
- `CRON_SECRET`
- `WORK_DEVICE_REQUIRED`, once the PCs are registered

Turnfin Me (`apps/me`):
- a separate Vercel project with root directory `apps/me`;
- `NEXT_PUBLIC_STAFF_API_URL=https://<work-host>/api/staff/v1`.

## Local

`npm run sandbox` (Work on :3100) enables the staff API for `http://localhost:3101`
and prints codes to its console (`STAFF_EMAIL_DEV_LOG`). The `me` launch
configuration starts Turnfin Me on :3101 against it.

## Files

- **Work, staff API:** `src/lib/staff-api/*` and `src/app/api/staff/v1/[[...path]]/route.ts`.
- **Personal reads and writes:** `src/lib/*/mine.ts` and `*/self.ts`.
- **Review queues:** `src/lib/people/details-*.ts`, `src/lib/training/certificate*.ts`.
- **Reminders:** `src/lib/staff-api/reminders.ts` and `src/app/api/cron/reminders/route.ts`.
- **Work-device rule:** `src/lib/devices/work-device.ts`.
- **Turnfin Me:** `apps/me/**`. Its tokens are copied from `src/app/docs/poolside.css`; keep them in step.
- **Tests:**
  - `src/lib/staff-api/api.test.ts`
  - `src/lib/staff-api/reminders.test.ts`
  - `src/lib/people/reviews.test.ts`
  - `src/lib/devices/work-device.test.ts`
