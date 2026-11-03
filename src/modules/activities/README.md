# Classes (Activities)

**Purpose:** runs the centre's classes and courses for the people booked on them.

It covers the menu entries Classes (the desk, `src/app/(activities)`; the app id stays `swim-school` and its log name Swim school), Pool deck (`src/app/(instructor)`) and Analytics, and the parent app's APIs. Classes was named Swim school until D24 (3 November 2026), when short courses joined it as its second kind of course. Its levels and the rules that protect swimmers' data are in [docs/apps.md](../../../docs/apps.md).

## Features
- `students` — the swimmer directory, a swimmer's profile and history, adding swimmers and parent changes (`/students`).
- `courses` — classes: browsing, adding and changing them, one class's page (`/courses`); the operations API's course and swimmer writes.
- `attendance` — the class page and register at the desk (`/courses/[id]/class`, `/register`, `/assess`).
- `enrolment` — the awaiting-enrolment queue and moves, legend agreements, scheduled unenrolments (`/awaiting-enrolment`, `/legend-agreements`).
- `assessments` — assessment sessions, their set-up and types (`/assessments`).
- `curriculum` — programmes, levels, competencies and their images (`/programmes`).
- `cancellations` — cancelled sessions to bill, their prices and the export (`/cancellations`).
- `duty` — the duty manager's view of the day (`/duty`).
- `schedule` — the week's timetable (`/schedule`).
- `today` — the swim school's day (`/today`).
- `together` — swimmers who can be taught together (`/together`), at their levels now or at levels someone wants to try ("what if"; nothing is saved), and "Move them here" to make an option real (enrolment.manage; one transaction, audited).
- `analytics` — the swim school reports (`/analytics`): Overview, Classes (and each class), Swimmers, Progression, Teachers (and each teacher, by who started each lesson), Reception (and each person on the desk: work done, response times against targets, busy hours, record quality), plus the Registers and multiple-places reports. Swim school Manage only. Reception reads the log through Core (under the apps' log names before and since D24) and the Academy's and Finance requests' timed jobs through `registerDeskMeasures`.
- `parents` — parent accounts and access requests (`/students/parents`), the parent API and the parent-admin API.
- `instructor` — the pool-deck workspace: today's classes, starting a class, assessments and swimmers (`/instructor`).
- `failed-payments` — the lists (`/payments`: to contact, contacted, closed; by site, month, or a search for name, member number or reference) and one failure's page (`/payments/[id]`). On that page reception logs a contact (phone, text, email or at the desk; no answer, left a message or spoke to them) and closes it: **Paid at the desk**, **New mandate set up** or **Place cancelled** (with a reason). Swim school Manage can open a closed one again. The page shows the swimmer's contact from the swim school's records when the member number matched, what the bank's return code means, and the member's other failed payments. Manage also gets **Remove N non-swimmers** on the list while any payment at their sites has no swimmer behind it (from sheets uploaded before swimmers only): after a confirmation it removes them with their history, one audit row each, and links any whose member number is a swimmer's now. This feature also gives the swim school's failed-payment Home items and the swimmer profile's notices. Its access check is `shared/payments/access.ts`; its page sits in the swim school frame on its Overview (`/payments`, guarded by `src/app/(activities)/payments/layout.tsx`).
- `payment-upload` — the failed payments sheet (D21, part of the swim school since D24): the upload page (`/payments/upload`, Manage only). Choose the file; the month is read from its name ("Failed Lessons 09" is September) and can be changed. The count per site comes first and saves nothing; **Add** reads the file again and adds each debit not already in for that month, at the sites where the person holds `payments.manage`. Every row is a debit: a debit is its reference, amount and copy within the month (the same reference can fail twice for different amounts), so uploading the same sheet again adds nothing. The short **Failed DDs** sheet (owner, 3 November 2026) is read too: only Contact Name, Amount, Return Description and Membership Number, a tab per site; its tab name is the club (matched by site code, "CF" is Churchfield), its member number is the reference, and its return code comes from the description (`CODE_FOR_REASON`; an unknown description keeps no code). The bank's "LW Douglas" is the Gus Healy Swimming Pool (`CLUB_ALIASES` in `shared/payments/rules.ts`). The same sheet uploaded again is refused under any month, by a hash of its debits kept on `PaymentImport.fingerprint`. A club name that matches no site is named and its debits left out; the rest are added, and once the site exists the same sheet uploaded again adds only those. A browser's copy number in the name ("Failed Lessons 09 (1)") is not read as the month. Only debits whose member number belongs to a swimmer are tracked (owner, 2 November 2026): member numbers are matched to the swim school's swimmers (capitals, no spaces) through the member directory, and every other row (gym memberships, unknown numbers) is counted on the preview and left out. Under the form, **Recent uploads** lists the latest sheets (month, file, who, when, how many of its payments are still on the list); Manage can **Remove this upload** after a confirmation, which removes every payment it added at their sites with its history, one audit row each, and once none are left removes the upload's record so the same file can go in again (owner, 3 November 2026).
- `short-courses` — six and eight week courses at the pool, the gym or the studio (D24: part of Classes since 3 November 2026, with their own tables and registers for now): the list (`/short-courses`, on the Overview), one course's page (`/short-courses/[id]`), putting courses on, booking people from the swimmer records, payment, the waiting list and registers; its sessions for the Rota, its Home items, a swimmer's short course history, the Pool courses in the parents app, and the places under an email for "My bookings" on the Academy booking site. The desk opens them with `short-courses.read` (Desk) and books; instructors open them with `short-courses.run` (Pool deck Teach) and take registers; Manage puts courses on (`short-courses.manage`). Its access check is `shared/short-courses/access.ts`, and `src/app/(activities)/short-courses/layout.tsx` runs it.
- `short-course-types` — the short course list, kept with Manage (`/short-courses/types`, under Set up).
- `workspace` — the swim school frame, its menu (`NAV_ITEMS`, for the page bar and the starter page `/swim-school`) and workspace search (`src/app/(activities)/layout.tsx`).

`shared/` holds what two or more features use, by domain (`shared/<domain>/`):
- the class, swimmer, enrolment, attendance, progression, assessment and curriculum rules, reads and actions that several screens call;
- the register form, teaching UI and deck checklist shared by the desk and the deck;
- the parent API's plumbing;
- `payments/`: failed payments' statuses and words (`types.ts`), the pure rules, including reading the bank's sheet (`rules.ts`, tested in `rules.test.ts`), the access check (`access.ts`) and the locked, audited step (`service.ts`);
- `short-courses/`: short courses' rules and words (`rules.ts`), the access check (`access.ts`), the writes' site check (`server.ts`), reads' site filter (`reads.ts`), holding places for payment (`public-booking.ts`), and booking people from the swimmer records through the member directory (`swimmers.ts`, `swimmer-search.ts`, `components/`). The Academy keeps its own copy of the last three; neither imports the other;
- `classification.ts` (what the deck may show) and `types.ts`.

The swim school is one tightly linked domain, so about 90 of its 280 files are shared. Splitting the larger shared files by declaration, as was done for the other modules, could move more code into features later.

## Front door (index.ts)
- `processScheduledUnenrolments()` — runs due unenrolments (session hooks).

## Data owned
`prisma/schema/activities.prisma`:
- `Programme`, `Level`, `Competency`
- `Student`, `StudentFollowUp`
- `Course`, `Enrolment`, `AttendanceRecord`, `ClassNote`, `ClassCancellation`, `CancelledClassSwimmer`, `ClassCover`, `ClassPlannedTeacher`
- `CompetencyResult`, `LevelCompletion`
- `AssessmentSession`, `AssessmentType`, `AssessmentBooking`
- `ManualPlacement` — swimmers the desk put on Awaiting enrolment by hand, without an assessment
- `LegendAgreementPrice`
- the `Parent*` tables of the parent app
- `PaymentImport` (`payment_imports`), `PaymentFailure` (`payment_failures`), `PaymentFailureEvent` (`payment_failure_events`): each uploaded failure sheet, each failed direct debit and its history (contacts and changes). Added for Payments (D21, migration `20261211090000_payments`) and owned here since D24; the tables kept their names.

`prisma/schema/activities.short-courses.prisma` (D24, table names kept, so nothing was copied):
- `ShortCourseType`, `ShortCourse`, `ShortCourseSession`, `ShortCourseParticipant`, `ShortCourseAttendance`: the short course list, each course put on, its sessions, who is booked or waiting, and the registers. Moving them onto `Programme` with an `activityType`, and their registers onto the pool deck, is a later step.

It never queries Core tables. It reads people and sites through `src/lib/directory.ts`.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Commitments (`activities.classes`): each class, its time and who teaches it, for the rota. Also `plan`, which records a class's planned teacher. The rota's Plan is the only place a class's teacher is chosen (owner decision, 16 October 2026); `Course.instructorId` is kept but only counts until the grace day `USUAL_INSTRUCTOR_UNTIL` (`shared/courses/planned.ts`).
- Site summary: programmes, swimmers and classes on Sites.
- Starter page items (`registerHomeCard`; Home counts the ones that need the person): Swim school (today's classes and assessments, swimmers awaiting enrolment, parent updates, failed payments to contact and waiting on the member, and Manage's "Upload the failure sheet") and Pool deck (the viewer's classes today).
- Area rename: classes and assessment sessions follow an area renamed in Admin.
- Member directory (`registerMemberDirectory`, `features/students/server/members.ts`): the swimmer records other modules book people from (owner request, 21 October 2026). Short courses and the Academy search, read (medical notes only when they say their viewer may) and add swimmers; the swim school writes and audits every add. The swimmer profile's **Other courses** reads `memberHistoryFor`.
- Member notices (`registerMemberNotices`): "Payment failed" on the swimmer profile of anyone with a failed payment still open.
- Short courses: their sessions as commitments (`short-courses.sessions`), area renames, member history (`short-courses.bookings`), the parents app's courses (`registerAppCourses`) and the places under an email (`registerEmailBookings`). Their Home items join the Classes card, and today's registers the Pool deck's.
- Menu entries, levels and permissions: `manifest.ts` (Classes, Pool deck and Analytics), listed in `src/app/modules.ts`. A role's stored Short courses level counts here (`formerly`): View as Classes Desk, Instructor as Pool deck Teach, Manage as Classes Manage.

## Permissions
- Classes: `swimschool.desk`, `students.manage`, `courses.manage`, `enrolment.manage`, `curriculum.manage`, `classes.cancel`, `billing.notify`, `parents.manage`, `progression.override`, `payments.read`, `payments.follow` and `short-courses.read` (Desk), `payments.manage` and `short-courses.manage` (Manage).
- Pool deck: `attendance.mark`, `attendance.markAny`, `attendance.cover`, `progression.assess`, `progression.complete`, `assessments.run`, `short-courses.run` (Teach).

## Depends on
- Platform: auth and the session, the policy engine, permissions, audit, the database client, `src/lib/directory.ts`, home cards, site summaries, commitments, the member directory, member history and member notices, the parents app's courses and the email bookings plug, and the workbook reader (`src/lib/xlsx.ts`) for the failure sheet.
- The UI kit's account menu, working-site switcher and wrong-site notice (`src/components/ui`: `account-menu.tsx`, `club-switcher.tsx`, `wrong-club.tsx`); switching runs Core's `switchClub` through the frame context.
- Other modules: none.
