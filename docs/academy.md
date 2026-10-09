# Turnfin Academy

Owner decision, 8 October 2026: a module for the lifeguard and swim teacher courses we deliver
from time to time, "similar to the swim school". Courses are for the public and for our own
staff. Staff enter candidates and record payment taken elsewhere. Each course tracks its sessions
and registers, the pre-course checks and the certificates. Tutors are our staff, and their
sessions show on the Rota.

## The model (`prisma/schema/academy.prisma`)

| Concept | Table | What it is |
| --- | --- | --- |
| Course on the list | `AcademyCourseType` | A course we deliver: "National Pool Lifeguard Qualification". Kind (lifeguard, swim teacher, other), awarding body, minimum age, hours to attend, the pre-course checks it asks for (`ACADEMY_CHECKS`: age, swim test, medical form, photo ID), and the qualification a staff member gets when they pass. Archived, never deleted. |
| Course | `AcademyCourse` | One run of it at a site: places, price, tutor, assessor (or the tutor). Planned, then **running** once its first session comes (worked out), then completed or cancelled. |
| Session | `AcademySession` | A dated session in one of the site's areas (Admin, Areas). Keeps who took its register. |
| Candidate | `AcademyCandidate` | One of our staff (`userId`) or a member of the public by name, with email, phone and date of birth; payment (paid, deposit, owed, no charge) and the amount paid; the day each check was done; the result (passed, referred, not yet competent, or withdrawn) with the certificate number and expiry. |
| Attendance | `AcademyAttendance` | The minutes a candidate was at a session (0 when absent). |
| Call | `AcademyCall` | A phone call to someone who held a place online: paid (amount and till receipt), no answer, asked us to call back, or not going ahead; who called and when. |
| Email check | `AcademyEmailCheck` | The booking site's email code, then a one-hour token. Only hashes are kept. |

The rules are in `src/modules/academy/lib/rules.ts` and are pure. `readiness` gives each check (age is
read from the date of birth on the first day) and the hours attended against the minimum. A
candidate is ready when every check is done and the hours are met. `expiryFrom` dates a pass:
the certificate's own expiry, else the qualification's validity from the result day.

## Levels (`src/modules/registry.ts`), at the sites a role covers

- **View** (`academy.read`): see the courses.
- **Tutor** (`academy.run`): add candidates and payment, record checks, take registers, record results.
- **Manage** (`academy.manage`): keep the course list, and put courses on with their sessions, tutor and price.

Every write checks the course's site (`mayFor`) and is audited under "Academy".

## A pass puts the qualification on the staff record

When a staff member passes a course whose type names a qualification, `recordResult` creates
their `Qualification`, verified by whoever recorded the result. Its reference is the
certificate number and its expiry comes from `expiryFrom`. Their HR file and
Training's expiring list read it, and expiry reminders follow. Changing the pass to another
result withdraws that qualification again. Members of the public keep their result on the
course only.

## On the Rota

The Academy reports each session of a course that is not cancelled through the commitments
seam (`academy.sessions` in `src/modules/academy/lib/contributions.ts`). It reports once for the tutor
and once for the assessor, when that is someone else. The Rota draws these as a read-only
activity in the session's area on every department's plan (`DayBooked`, `ANY_DEPARTMENT` in
`src/lib/rota/day.ts`), linked back to the course. The time counts in the tutor's shift and
in double-booking warnings, and "Who can fill it" sees them as busy. They are never gaps
for the Rota to fill. The Rota never reads Academy tables.

## Online booking

Owner decision, 8 October 2026. The public book on a separate site,
`academy.leisureworldcork.com` (`apps/academy`), like the parent app for the swim school. We
cannot take payment online, so a booking **holds a place** and reception **phones within 72
hours** to take payment.

- **Which courses.** A course shows online when Manage ticks **Open for online booking**
  (`AcademyCourse.bookOnline`), until its first session (`bookableOnline`). Full courses stay
  listed as full. The site shows the course, dates, areas, minimum age, pre-course checks and
  price; never staff names, other candidates or notes.
- **Holding a place.** The person checks their email with a six-digit code, then gives their
  name, mobile number (and another, optional), date of birth (checked against the minimum age on
  the first day), the best time to phone (morning, afternoon, evening) and an optional note. One
  place per email on a course; the last place is never taken twice (the course row is locked
  while places are counted).
- **What it makes.** A candidate with `source` online, a reference ("AC-4821"), payment owed and
  `callBy` 72 hours after holding the place (`ONLINE_HOLD_HOURS`). They get an email saying
  their place is held, when we will phone, and the reference. The place counts as taken.
- **To call** (`/academy/calls`). Everyone who held a place online and still owes, at the sites
  the person covers, soonest deadline first: overdue in red, due within a day in amber
  (`ACADEMY_CALL_DUE_META`, from `callDue`). Every Academy level (View, Tutor, Manage) sees the
  list and logs calls (owner decision, 8 October 2026). Each row and the course page have **Log a
  call** (`logCall`): paid records the amount and the till receipt (the full price is paid, less
  is a deposit; either way they leave the list), no answer and call back keep them on it, not
  going ahead withdraws them and frees the place. Every call is kept and audited.
- **Overdue** places stay held until someone records a call. Nothing is cancelled automatically.
- The home card shows how many are waiting to be phoned, flagged when any are past 72 hours.

### The booking API (`/api/academy/v1`)

The site never touches the database: it calls Work's Academy API, the same contract as the
parent and staff APIs (JSON only, 16 KiB bodies, allowlisted origins, no cookies, never cached).

| Method | Path | What |
| --- | --- | --- |
| GET | `courses` | The courses open online, soonest first |
| GET | `courses/{id}` | One of them (404 once it starts or leaves online booking) |
| POST | `auth/request-code` | Email a six-digit code (5 an hour per address, 30 per IP) |
| POST | `auth/verify-code` | A right code gives a token for an hour; five wrong ones end the code |
| POST | `bookings` | Hold a place (Bearer token): 201 with the reference and when we will phone; 409 `FULL` or `ALREADY_BOOKED`; 422 `TOO_YOUNG` |

### Configuration

Work (the Swimly app):
- `ACADEMY_API_ENABLED=true`
- `ACADEMY_AUTH_SECRET` (32+ characters; its own, not the parent or staff secret)
- `ACADEMY_API_ALLOWED_ORIGINS=https://academy.leisureworldcork.com`
- `ACADEMY_EMAIL_NAME` (the name its emails show, "LeisureWorld Academy"). The mailbox is Core's
  one sender (`src/lib/email/sender.ts`): `TURNFIN_EMAIL_FROM` and `TURNFIN_GOOGLE_*`, falling
  back to the parent app's `PARENT_*`. `ACADEMY_EMAIL_FROM` and `ACADEMY_GOOGLE_*` are no longer
  read; move any value set there to the `TURNFIN_*` names.

The booking site (`apps/academy`):
- a separate Vercel project with root directory `apps/academy`, on `academy.leisureworldcork.com`;
- `NEXT_PUBLIC_ACADEMY_API_URL=https://<work-host>/api/academy/v1`;
- `NEXT_PUBLIC_ACADEMY_NAME` (optional; "LeisureWorld Academy").

Locally, `npm run sandbox` (Work on :3100) turns the API on for `http://localhost:3102` and
prints codes to its console (`ACADEMY_EMAIL_DEV_LOG`). The `academy-site` launch configuration
starts the booking site on :3102 against it. The sandbox has an NPLQ course next month open
online with three invented people waiting for a call (one overdue), and a swim teacher course.

## Home

Tutors see the registers to take today. Everyone with View sees the courses starting in the
next two weeks at their sites.

## Files

- Schema: `prisma/schema/academy.prisma`, migrations `20261023120000_academy` and `20261024120000_academy_online_booking` (additive)
- `src/modules/academy/lib/`: `rules.ts` (pure), `access.ts`, `data.ts`, `actions.ts`, `contributions.ts`
- UI: `src/app/academy/` (courses, a course, the course list, to call), `src/modules/academy/components/`
- Online booking: `src/modules/academy/lib/public/` (`http.ts`, `api.ts`, `email.ts`, `router.ts`),
  `src/app/api/academy/v1/[[...path]]/route.ts`, and the site in `apps/academy`
- Tests: `rules.test.ts`, `academy.test.ts`, `public/api.test.ts` (the booking API and the call
  list end to end), and the booked-session case in `src/lib/rota/day.test.ts`
- Sandbox: an NPLQ course at Hillview started yesterday. Sam tutors and Liam assesses.

## Not done yet

Taking payment online, unit-by-unit assessment, and the course in a tutor's own Turnfin Me.
