# Swim school (Activities)

**Purpose:** runs the swim school's classes for its swimmers.

It covers both menu entries Swim school (the desk, `src/app/(activities)`) and Pool deck (`src/app/(instructor)`), and the parent app's APIs. See [docs/how-turnfin-works.md](../../../docs/how-turnfin-works.md) and [docs/instructor.md](../../../docs/instructor.md).

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
- `together` — swimmers who can be taught together (`/together`), at their levels now or at levels someone wants to try ("what if"; nothing is saved).
- `analytics` — the swim school reports (`/analytics`): Overview, Classes (and each class), Swimmers, Progression, Teachers (and each teacher, by who started each lesson), Reception (and each person on the desk: work done, response times against targets, busy hours, record quality), plus the Registers and multiple-places reports. Swim school Manage only. Reception reads the log through Core and Short courses' and Refunds' timed jobs through `registerDeskMeasures`.
- `parents` — parent accounts and access requests (`/students/parents`), the parent API and the parent-admin API.
- `instructor` — the pool-deck workspace: today's classes, starting a class, assessments and swimmers (`/instructor`).
- `workspace` — the swim school frame, its menu (`NAV_ITEMS`, for the page bar and the starter page `/swim-school`) and workspace search (`src/app/(activities)/layout.tsx`).

`shared/` holds what two or more features use, by domain (`shared/<domain>/`):
- the class, swimmer, enrolment, attendance, progression, assessment and curriculum rules, reads and actions that several screens call;
- the register form, teaching UI and deck checklist shared by the desk and the deck;
- the parent API's plumbing;
- `classification.ts` (what the deck may show) and `types.ts`.

The swim school is one tightly linked domain, so about 90 of its 280 files are shared. Splitting the larger shared files by declaration, as was done for the Work modules, could move more code into features later.

## Public API (index.ts)
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

It never queries Core tables. It reads people and sites through `src/lib/directory.ts`.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Commitments (`activities.classes`): each class, its time and who teaches it, for the rota. Also `plan`, which records a class's planned teacher. The rota's Plan is the only place a class's teacher is chosen (owner decision, 16 October 2026); `Course.instructorId` is kept but only counts until the grace day `USUAL_INSTRUCTOR_UNTIL` (`shared/courses/planned.ts`).
- Site summary: programmes, swimmers and classes on Sites.
- Starter page items (`registerHomeCard`; Home counts the ones that need the person): Swim school (today's classes and assessments, swimmers awaiting enrolment, parent updates) and Pool deck (the viewer's classes today).
- Area rename: classes and assessment sessions follow an area renamed in Admin.
- Menu entries, levels and permissions: `manifest.ts` (Swim school and Pool deck), listed in `src/app/modules.ts`.

## Permissions
- Swim school: `swimschool.desk`, `students.manage`, `courses.manage`, `enrolment.manage`, `curriculum.manage`, `classes.cancel`, `billing.notify`, `parents.manage`, `progression.override`.
- Pool deck: `attendance.mark`, `attendance.markAny`, `attendance.cover`, `progression.assess`, `progression.complete`, `assessments.run`.

## Depends on
- Platform: auth and the session, the policy engine, permissions, audit, the database client, `src/lib/directory.ts`, home cards, site summaries and commitments.
- The UI kit's account menu, working-site switcher and wrong-site notice (`src/components/ui`: `account-menu.tsx`, `club-switcher.tsx`, `wrong-club.tsx`); switching runs Core's `switchClub` through the frame context.
- Other modules: none.
