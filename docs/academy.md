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

The rules are in `src/lib/academy/rules.ts` and are pure. `readiness` gives each check (age is
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
certificate number and its expiry comes from `expiryFrom`. Their Staff page, HR file and
Training's expiring list read it, and expiry reminders follow. Changing the pass to another
result withdraws that qualification again. Members of the public keep their result on the
course only.

## On the Rota

The Academy reports each session of a course that is not cancelled through the commitments
seam (`academy.sessions` in `src/lib/academy/contributions.ts`). It reports once for the tutor
and once for the assessor, when that is someone else. The Rota draws these as a read-only
activity in the session's area on every department's plan (`DayBooked`, `ANY_DEPARTMENT` in
`src/lib/rota/day.ts`), linked back to the course. The time counts in the tutor's shift and
in double-booking warnings, and "Who can fill it" sees them as busy. They are never gaps
for the Rota to fill. The Rota never reads Academy tables.

## Home

Tutors see the registers to take today. Everyone with View sees the courses starting in the
next two weeks at their sites.

## Files

- Schema: `prisma/schema/academy.prisma`, migration `20261023120000_academy`
- `src/lib/academy/`: `rules.ts` (pure), `access.ts`, `data.ts`, `actions.ts`, `contributions.ts`
- UI: `src/app/academy/` (courses, a course, the course list), `src/components/academy/`
- Tests: `rules.test.ts`, `academy.test.ts`, and the booked-session case in `src/lib/rota/day.test.ts`
- Sandbox: an NPLQ course at Hillview started yesterday. Sam tutors and Liam assesses.

## Not done yet

Online booking and payment, unit-by-unit assessment, and the course in a tutor's own Turnfin Me.
