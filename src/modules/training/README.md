# Training

**Purpose:** makes sure staff get the training and qualifications their jobs need.

The rules for courses, assignments, sign-offs and certificates are in [docs/training.md](../../../docs/training.md).

## Features
- `courses` — training courses: create, change settings, archive, and the qualification each grants (`/training/courses`).
- `builder` — building a course from sections and lessons (reading, video, file, quiz, scenario, flashcards, checklist, audio) with interactive blocks and knowledge checks, each section's questions (pasted from a spreadsheet too), the final exam and how it has gone, templates, duplicating and copying in, the cover, review comments, preview and publishing numbered versions with a note and optional retake (`/training/courses/[id]`, `/training/files`).
- `assignments` — assigning training, following and cancelling it, giving another exam attempt, and one person's training and exam scores (`/training`, `/training/people/[id]`).
- `sign-off` — practical sign-offs: confirming a skill shown in person, or returning it for practice; observing against the course's checklist on a tablet, with photos (`/training/sign-off`, `/training/sign-off/[id]`, `/training/evidence/[id]`).
- `paths` — learning paths: courses in order with due days from a start date, putting people on one and taking them off (`/training/paths`).
- `sessions` — classroom and poolside sessions: places, bookings, the register, and closing it to credit hours and complete the course (`/training/sessions`).
- `hours` — in-service hours against what each qualification needs, logged by hand or from a register (`/training/hours`).
- `certificates` — checking certificates people upload in Turnfin Me (`/training/certificates`).
- `compliance` — training rules that assign courses by position, role, department and site and renew them, their daily run, the training matrix and its download, and checking a certificate code (`/training/rules`, `/training/matrix`, `/training/check`, `/api/cron/training`).
- `expiring` — qualifications expired or due soon (`/training/expiring`).
- `me` — a person's own training for Turnfin Me: their list, their certificate for finished training, taking a course lesson by lesson, practice quizzes, sitting the final exam, completing it, and the reminder digest; their own space: search, bookmarks and private notes, their record, the course catalogue and enrolling, rating a course, daily refreshers, streaks and badges. Reached through `index.ts`.
- `insight` — course analytics (how far people get, where they stop, time taken, the exam, by site), the reports page (overdue by site and line manager, each course's numbers), downloads for Excel and audit packs for a person or a course (`/training/courses/[id]/insight`, `/training/reports`, `/training/people/[id]/audit`, `/training/courses/[id]/audit`).
- `person-file` — Training's part of a person's file and their records for HR's subject export.
- `workspace` — the Training frame, its one page list (`pages.ts`, for the page bar and the starter page `/training/overview`) and the access check (`src/app/training/layout.tsx`).

`shared/` holds what two or more features use: lessons, outlines, cleaning lesson text, lesson settings and video links (`lessons.ts`), questions, marking and exam papers (`questions.ts`), refreshers, streaks, badges and search (`learner.ts`), course templates (`templates.ts`), reading pasted questions (`import.ts`), lesson files (`files.ts`), the lesson renderer, statuses and states (`constants.ts`), the access check (`access.ts`), courses and the people a trainer may see (`data.ts`), granting a qualification on completion (`grant.ts`), write helpers (`writes.ts`) and the dialogs' kit.

## Public API (index.ts)
- `myTraining(userId)` — a person's own training, for Turnfin Me's staff API.
- `completeTrainingFor(person, id, note)` — a person completes their own training from Turnfin Me (every lesson first).
- `myCourse(userId, id)`, `myLesson(userId, id, lessonId)`, `completeLessonFor(person, id, lessonId)`, `myCourseFile(userId, id, fileId)` — taking a course lesson by lesson in Turnfin Me; `trainingFileResponse(file)` sends a lesson file.
- `checkQuizAnswer(...)`, `myExam(person, id)`, `myExamPaper(person, id)`, `startExam(person, id)`, `saveExamAnswer(...)`, `submitExam(person, id, attemptId)`, `myExamResult(userId, id, number)` — quizzes and the final exam in Turnfin Me.
- `myCertificate(user, id)` — the person's certificate for finished training, with its lasting code, for Turnfin Me.
- `trainingReminderItems(on)` — training due soon, for Turnfin Me's reminder digest.
- `myPlan(userId, orgId)`, `myPractical(userId, id)` — the person's own paths, sessions and hours, and what a trainer watches for on their practical, for Turnfin Me.
- `searchMyTraining`, `myLessonNote`, `saveLessonNote`, `mySaved`, `myRecord`, `catalogueFor`, `catalogueCover`, `enrolMyself`, `myFeedback`, `rateCourse`, `myRefresher`, `answerRefresher`, `refresherWaiting` — the learner's own space in Turnfin Me (phase 6).

## Data owned
Declared in `prisma/schema/training.prisma` (table names kept, ADR 0002):
- `TrainingCourse` — a course and what it grants.
- `TrainingAssignment` — one person's assignment, from assigned to completed or cancelled, and the course version they take.
- `training_sections`, `training_lessons` — a course's draft outline.
- `training_course_versions` — published courses, frozen.
- `training_files` — images, PDFs and recordings used in lessons, and the cover.
- `training_lesson_progress` — lessons a learner has finished.
- `training_questions` — each section's questions, for its quizzes and the final exam.
- `training_exam_attempts` — every exam sitting: its paper, answers and marks.
- `training_review_comments` — comments on a course's draft, and who marked them done.
- `training_rules` — one per course: who must take it, days to finish, and how often it renews.
- `training_evidence` — photos a trainer took at a practical sign-off.
- `training_paths`, `training_path_steps`, `training_path_enrolments` — learning paths, their courses in order, and who is on each.
- `training_sessions`, `training_session_places` — sessions and who is booked, attended or absent.
- `training_hours`, `training_hour_targets` — in-service hours logged, and how many each qualification needs.
- `training_lesson_notes` — a learner's bookmarks and private notes on lessons.
- `training_feedback` — a learner's rating of a finished course and what was unclear.
- `training_refresher_cards`, `training_refresher_days` — questions a learner missed, spaced out for daily refreshers, and how many they answered each day.

Training also reads and writes Core's qualification records (`Qualification`, `QualificationEvidence`, `QualificationType`) and reads `User`, `Club` and `Position`. Qualifications are Core's (ADR 0001); moving these reads onto Core functions is phase 3 of [MIGRATION.md](../../../docs/architecture/MIGRATION.md).

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Starter page items (`registerHomeCard`; Home counts the ones that need the person): practical sign-offs, registers to close, certificates to check, qualifications expiring.
- Person file section `training.open` and subject records `training`, `trainingOnTheJob` and `trainingLearner` (HR's export).
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- Levels: Trainer, Author (builds courses), Manage.
- `training.manage`, `training.assign`, `training.records.read`, `training.signoff`; `qualifications.manage` (Core's) for certificates and expiring qualifications.

## Depends on
- Platform: the policy engine (people a trainer may see), audit, the database client, contributions (home card, person file, subject records).
- Core reads (never Core tables; enforced by the boundary lint): people, positions, sites and line managers through `src/lib/directory.ts`; the audit trail of its own records through `src/lib/audit.ts` (`auditTrailFor`); qualifications, qualification types and uploaded certificates through `src/lib/qualifications.ts` (granting goes through `recordQualification`); the person's record through `src/lib/people/records.ts`.
- The UI kit's workspace frame `ModuleShell` (`src/components/ui/module-shell.tsx`).
- Other modules: none. HR reads Training's records through the `subjectRecords` seam.

## Known gaps
- `src/app/training/certificates/[id]/file/route.ts` serves the file itself (through Core's `certificateFile`) rather than through the `certificates` feature.
