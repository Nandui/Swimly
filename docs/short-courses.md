# Short courses

Owner decision, 13 October 2026: a module for fixed-length courses the public book a place on,
"like 6 weeks, 8 weeks", at the pool, the gym or anywhere else. Since 15 October 2026 it also
holds the Academy's qualification courses, with their checks, results and certificates
(docs/academy.md, ADR 0011); the swim school (weekly classes with no end date) stays separate. The plan Fernando approved is the Artifact "Turnfin Short Courses
Plan" (https://claude.ai/artifact/XweXdCdj2EJG1V3os7DcFm); ADR 0009 records the decision.

Phase 1 (1.9.0) runs courses from the desk. Phase 2 (1.15.0) adds online booking on the public
booking site; phase 3 adds "run it again" and reports.

## The model (`prisma/schema/short-courses.prisma`)

| Concept | Table | What it is |
| --- | --- | --- |
| Course on the list | `ShortCourseType` (`short_courses_types`) | A course we offer: "Couch to 5k". Where (pool, gym, studio, other), what it is, how many weeks and minutes a session a new run starts with, minimum age, and whether it asks for a health form (a PAR-Q for the gym). Archived, never deleted. |
| Course | `ShortCourse` (`short_courses_courses`) | One run at a site: places, price, instructor, note. Planned, then **running** once its first session comes (worked out), then finished or cancelled. |
| Session | `ShortCourseSession` (`short_courses_sessions`) | A dated session in one of the site's areas (Admin, Areas), with who took its register. |
| Person | `ShortCourseParticipant` (`short_courses_participants`) | A member of the public by name, phone, email and (when the course has a minimum age) date of birth; booked, waiting or withdrawn; payment (paid, deposit, owed, no charge) and the amount paid; the day their health form came in. |
| Attendance | `ShortCourseAttendance` (`short_courses_attendance`) | Whether they were at a session. |

The tables keep plain ids for the site, the instructor and the organisation and read Core only
through its functions (`src/lib/directory.ts`, `src/lib/setup/data.ts`), so the module has no
relation to any Core table. The migration `20261103120000_short_courses` only adds tables.

The rules are in `src/modules/short-courses/shared/rules.ts` and are pure (tested in
`rules.test.ts`).

## Putting a course on

Manage picks the course from the list, the site, the first day, how many weeks, the start and end
time, the area, the instructor, the places and the price. Turnfin makes a session on the same
weekday each week (`weeklyDates`). The weeks and session length come from the course list and can
be changed for this run. A week that moves (a bank holiday) is changed on its own session; an
extra week is added with **Add a session**, which suggests a week after the last. A session whose
register has been taken can be moved but not removed.

Changing a course later changes its places, price, instructor and note. Places never go below the
number booked.

## Booking people on

Anyone with View at the course's site books people on, records the payment taken at the till and
keeps the waiting list.

- **Places.** Only a booking takes a place. The course row is locked while places are counted, so
  the last place is never taken twice.
- **Waiting list.** When the course is full, the desk adds people to the waiting list instead. It
  is first come, first served (`waitingOrder`). When a place frees up (someone withdraws, or
  Manage adds places) the course page says so, the first person waiting is highlighted, and the
  desk offers them the place by phone and then presses **Give the place**. Home shows courses with
  a place free for the waiting list. Nothing moves automatically.
- **Payment.** Paid with no amount records the full price. "Still to pay" on the course adds up
  what each booked person owes (the price less what they paid; nothing for paid or no charge).
- **Age.** When the course has a minimum age, the date of birth is required and checked against
  the first day.
- **Health form.** When the course asks for one, the day it came in is recorded, and anyone
  booked without one shows **No health form**.
- **Withdrawing** frees the place and keeps the person and their register marks on the course. A
  withdrawn person can be put back (onto the waiting list when the course is full). Refunds are
  handled at the till.

## Online booking (phase 2, 15 October 2026)

The public book on the same site as the Academy's courses, `academy.leisureworldcork.com`
(`apps/academy`, docs/academy.md, ADR 0011), the same way: we cannot take payment online, so a
booking holds a place and the desk phones within 72 hours to take payment.

- **Which courses.** Manage ticks **Open for online booking** on the course
  (`ShortCourse.bookOnline`). It shows online until its first session (`shortCourseOnline`), with
  what it is, the weekly dates and times, the area, the minimum age, "Health form" when it asks
  for one, and the price; never the instructor, other people or notes.
- **Holding a place** needs the email checked with a code. They give the name of the person
  taking the course, a mobile number (and another, optional), the date of birth only when the
  course has a minimum age, the best time to phone and an optional note. One booking per email on
  a course; the course row is locked while places are counted.
- **What it makes.** Someone booked with `source` online, a reference ("SC-4K8PZ"), payment owed
  and `callBy` 72 hours later. They get an email with the reference and when we will phone.
- **Full courses** offer the **waiting list** online instead. They join it in order, with no
  deadline; the desk offers a freed place by phone as for anyone waiting.
- **To phone.** The courses page lists everyone booked online who still owes, soonest deadline
  first (overdue in red, due within a day in amber, `SHORT_COURSE_CALL_DUE_META`), with their
  numbers, best times and reference. On the course their row shows the same. Record the payment
  taken at the till with the pencil as usual and they leave the list; withdraw them if they are
  not going ahead. The home card counts them, flagged when any are past 72 hours. Overdue places
  stay held until someone acts.
- Customers see these bookings, and any the desk entered under their email, in **My bookings**.

## Registers

Anyone with Instructor at the site takes a session's register from the day of the session:
everyone booked is ticked, and the instructor unticks whoever was not there. Everyone booked is
marked present or absent, so a person's line reads "at 5 of 6". It can be changed later.

## Levels (`src/modules/short-courses/manifest.ts`), at the sites a role covers

- **View** (`short-courses.read`): see the courses, book people on, record payment, keep the waiting list.
- **Instructor** (`short-courses.run`): also take the registers.
- **Manage** (`short-courses.manage`): also keep the course list and put courses on, with their weeks, times, instructor, places and price.

Every write checks the course's site (`mayFor`) and is audited under "Short courses".

## On the Rota

Each session of a course that is not cancelled reaches the Rota through the commitments seam
(`short-courses.sessions`, registered in `module.ts`), for the instructor. The Rota draws it in
its area on every department's plan as "Planned in Short courses", linked back to the course. The
time counts in the instructor's shift and in double-booking warnings, and it is never a gap for
the Rota to fill. The Rota never reads these tables. When Admin renames an area, the sessions
there follow (`registerAreaRename`).

## Home

Instructors see the registers to take today on their courses. Everyone with View sees courses
with a place free for the waiting list, and courses starting in the next two weeks at their sites.

## Files

- Schema: `prisma/schema/short-courses.prisma`, migrations `20261103120000_short_courses` and `20261108120000_short_courses_online` (additive).
- `src/modules/short-courses/`: `shared/` (`rules.ts`, pure; `access.ts`; `server.ts` and `reads.ts`; the dialogs' `components/form-kit.tsx`; `public-booking.ts`, the booking site's shape), and the features `courses`, `course-types`, `booking` (the booking site's API and both kinds of course on it) and `workspace`, plus the Academy's (docs/academy.md). See its README.md.
- UI: `src/app/short-courses/` (courses, a course, the course list, the starter page).
- Tests: `rules.test.ts` and `__tests__/short-courses.test.ts` (end to end on an isolated database).
- Sandbox: Couch to 5k at Hillview two weeks in, with two people waiting for a free place; Adult swim lessons at Riverside starting in ten days, open online, with one invented place held online and overdue for a call.

## Not done yet

- **An email when a waiting-list place opens** (the desk phones for now).
- **Phase 3:** run a course again, offering the next run to this group first; fill rate and
  takings per course and area.
