# Turnfin Training

Training is where LeisureWorld keeps its course catalogue, assigns training to
staff, has trainers sign off practical skills, and follows qualifications that
are about to expire. It lives in the main database and uses the platform access
model (see docs/platform-access.md): a role says what someone may do, an
assignment says over whom.

## Two surfaces

- **My training** in Turnfin Me (the staff app, docs/staff-app.md).
  Everyone's own courses. No permission is needed, and nothing there can reach
  another person's records. The learner reads the material and marks it done.
- **Training workspace** (`/training`, Poolside Clear, on the shared `ModuleShell`). The Manage
  surface for people with a Training capability. It opens for anyone with the
  Training screen and a Training capability **at any scope**, so a department
  lead's additional role opens it too. Every page then limits records to the
  people that capability covers.

## Capabilities

| Key | Lets you | Scope |
| --- | --- | --- |
| `training.manage` | Build courses: sections, lessons and files, preview and publish; create, retire and set the qualification each grants. Includes reading records. | Catalogue is organisation data |
| `training.assign` | Assign courses with a due date, and cancel assignments. Includes reading records. | The people the assignment covers |
| `training.records.read` | See training and qualifications. | The people the assignment covers |
| `training.signoff` | Sign off practical training, or send it back with what to practise. Never your own. Includes reading records. | The people the assignment covers |

None are restricted, so administrators hold them. Code resolves them through the
policy engine (`subjectsFor`, `requireCapFor`), never the flat session check.

## How a course works

1. A course is self-completed or needs a trainer's sign-off, and can grant a
   qualification type.
2. Assigning creates one open assignment per person and course (a partial unique
   index enforces it); people who already have it open are skipped.
3. The learner marks it done. A self-completed course is then **Completed**; a
   practical one is **Awaiting sign-off**.
4. A trainer who covers the person signs it off (**Completed**) or sends it back
   (**To do**, with a note the learner sees).
5. Completing a course that grants a qualification records it, issued today and
   expiring after the qualification type's validity. Signed-off courses are
   verified by the trainer; self-completed ones are unverified.

Statuses and their icons come from `TRAINING_STATUS_META` (and certificates from
`CERTIFICATE_STATUS_META`), shown with `<Tag meta={…} />`; "Overdue" is derived from the
due date.

## Courses built from lessons (e-learning, phase 1)

*Owner request, 15 October 2026: "a fully blown e-learning platform". The phased plan is the
"Turnfin E-learning Plan" artifact; phase 1 is the builder and the player. Quizzes and exams are phase 2 (below);
automatic assigning, renewals and certificates (phase 3) come next.*

Levels: **Trainer** (sign off), **Author** (also build and publish courses: `training.manage`),
**Manage** (also assign and check certificates). Levels are cumulative, so roles that had Manage
keep everything.

- **Draft.** A course has sections (`training_sections`) of lessons (`training_lessons`). A
  lesson is **Reading** (Tiptap JSON), **Video** (an https link; YouTube and Vimeo play inside
  the lesson through their privacy players, anything else opens in a new tab) or **File** (a PDF
  or image), each with optional notes and minutes. Lesson text is cleaned on save (`cleanDoc` in
  `shared/lessons.ts`): only headings, lists, key points, tables, links (http, https, mailto) and
  images that are the course's own files survive. Files (`training_files`, PDF, JPEG, PNG or WebP
  up to 4 MB, checked by their first bytes) are kept in the database and never deleted.
- **Publish** freezes the draft into the next `training_course_versions` row (the whole outline as
  JSON) and points the course at it. Nothing in a version is edited afterwards. Publishing needs at
  least one lesson, no empty sections, text in every Reading lesson, a link in every Video and a
  file in every File lesson.
- **Which version a learner gets.** An open assignment follows the latest published version until
  the learner finishes their first lesson; that fixes `TrainingAssignment.versionId`. So people who
  haven't started get the new version, and people part-way through keep theirs. Training that was
  submitted or completed before lessons existed stays on the old text.
- **Taking it** (Turnfin Me): one lesson per screen, Back and **Done, next lesson**; each finished
  lesson is a `training_lesson_progress` row, audited. The course page shows progress and Continue;
  Home shows Continue for a course part-way through. Finishing the course (or asking for sign-off)
  needs every lesson done, then follows the steps above.
- **Old courses.** A course with no published version shows its plain text as before. **Use the
  current text as lesson 1** in the builder turns it into a Reading lesson in the draft.
- **Preview** (`/training/courses/{id}/preview`) plays the draft in Work and records nothing.

## Quizzes and the final exam (e-learning, phase 2)

*Owner request, 15 October 2026 (19:13): "even more complete … state of the art". Plan v2 in the
"Turnfin E-learning Plan" artifact; phase 2 is quizzes and exams.*

- **Questions** belong to a section (`training_questions`): one right answer, several right
  answers, true or false, put in order, or match pairs, each with an optional picture (the
  course's own image files, on the question or on an answer) and an optional "why". The builder
  edits them under **Questions** in each section of the outline. Rules for each kind are in
  `questionProblem` (`shared/questions.ts`); publishing checks every question.
- **Quiz lessons** (a fourth lesson kind) practise their own section's questions, one at a time.
  The server checks each answer (`training/{id}/lessons/{lessonId}/check`) and says right or not;
  the "why" comes with a right answer, or when the learner asks to see it. Nothing is marked or
  kept, and the right answer itself is never sent. The learner works through every question before
  the lesson counts as done.
- **The final exam** is a course setting (`TrainingCourse.exam`, frozen into each version): pass
  mark (default 80%), attempts (default 3), how many questions each paper draws (default all),
  an optional time limit and **test out** (sit it before the lessons; a pass finishes the course).
  Each sitting is a `training_exam_attempts` row with its own paper, drawn and shuffled from a seed,
  answers saved one by one as the learner goes, and the marks. Marking is on the server and all or
  nothing per question; a paper's percentage rounds down. A timed paper has 30 seconds' grace and
  is handed in by itself, with the answers it had, the next time anything reads it.
- **What the phone gets.** Questions without the key; Match partners carry their own ids, never
  the left side's. After a fail: the score and the sections to go over again. After a pass: every
  question with the learner's answer, the right one and why.
- **Finishing.** A course with an exam finishes when the exam is passed and the lessons are done
  (or test-out is on): straight into sign-off for a practical course, otherwise complete with any
  qualification it grants. "Finish the course" without a pass is refused.
- **Attempts.** When someone has used every attempt, a person with Assign training for them gives
  one more from their training page (`examExtraAttempts`, audited). Their scores show there too.
- **How it has gone.** The exam panel in the builder shows sittings and pass rate, and the
  questions people miss most, across versions (question ids are kept when a course is
  republished).

## Expiring qualifications

`/training/expiring` lists qualifications that have expired or expire within 60
days for the people in scope, with the course that renews each (a course that
grants that type) and a one-click renewal assignment. A newer certificate of the
same type takes the person off the list. Turnfin Me shows each person their own and lets them upload a new certificate, which
a qualifications role checks under **Certificates to check**. Rota (phase 8) warns on expired qualifications but
does not block.

## Files

- Schema: `TrainingCourse`, `TrainingAssignment` (`prisma/migrations/20260930120000_training`); sections, lessons, versions, files and progress (`prisma/migrations/20261106120000_training_elearning`)
- Shape: `src/modules/training/` has `shared/` (`access.ts`, `constants.ts`, `data.ts`, `grant.ts`, `writes.ts`) and the features `courses`, `builder`, `assignments`, `sign-off`, `certificates`, `expiring`, `me`, `person-file` and `workspace`; see its README.md
- Actions: each feature's `server/actions.ts` (every change audited in its transaction)
- Self-service: `features/me` (`mine.ts`, `self.ts`, `reminders.ts`), reached by the staff API through `index.ts`; description in `manifest.ts`
- Pages: `src/app/training/` (workspace; the builder is `courses/[id]`, files `files/`); the learner side is Turnfin Me (`apps/me`, `training/[id]` and `training/[id]/[lesson]`)
- Tests: `src/modules/training/__tests__/training.test.ts`, `elearning.test.ts`
