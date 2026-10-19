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

## A richer builder and lessons (e-learning, phase 3)

*Owner request, 15 October 2026 (20:19): "the most complete elearning tool for the user and
builder". Plan v3 in the "Turnfin E-learning Plan" artifact; phase 3 is the builder and lessons.*

- **Blocks in lesson text.** Besides headings, lists, tables and pictures, the editor adds
  callouts (note, tip, take care, danger), tap to reveal, flip cards, step by step, and a
  **knowledge check**: one of the course's questions asked in the middle of the text. The server
  checks a knowledge-check answer exactly as it checks a quiz (`training/{id}/lessons/{lessonId}/check`),
  and publishing refuses a check whose question has been removed.
- **Four more lesson kinds** (`training_lessons.data`, cleaned by `cleanLessonData` in
  `shared/lessons.ts`):
  - **Scenario**: scenes with up to four choices each. A choice says what happens and either leads
    to another scene or ends it; one or more endings are the best outcome. Publishing needs every
    scene reachable from the first and a best ending (`scenarioProblems`). The learner finishes the
    lesson by reaching a best ending and can try again from any other.
  - **Flashcards**: front, back and an optional picture. Cards the learner didn't know come round
    again until every card is known.
  - **Checklist**: things to find, check or do, ticked off on the phone (kept on that phone only).
  - **Audio**: an uploaded recording (MP3, M4A, OGG or WAV) with an optional transcript as the
    lesson text.
  Each needs to be worked through before Next opens, like a quiz. A draft keeps the empty rows an
  author is still filling in; the published version drops them (`frozenOutline`).
- **Two more question kinds.** **Fill in the blanks**: the author writes the sentence with each
  missing word in [square brackets], other accepted answers after a | ("between [1|1.0] and [3]").
  Case, spaces, a final full stop and the way a number is written don't matter (`sameAnswer`).
  **Pick the spot**: the author draws one or more right areas on a picture; a tap inside any of
  them is right. Neither sends the answers or areas to the phone.
- **Starting points.** **Start from a template** offers five outlines (policy, practical skill,
  emergency procedure, refresher, induction; `shared/templates.ts`). Text the author must replace
  starts with ✎, and publishing is refused while any is left. **Duplicate** copies a whole course,
  its settings, files and questions, unpublished and with nobody assigned. **Copy in** brings
  chosen lessons and questions from another course into a section; a copied lesson brings the
  questions its knowledge checks ask. Every copy gets its own copies of the files.
- **Paste questions from a spreadsheet.** One question a row (Type, Question, Option A to F, Right
  answer, Why), straight from Excel or as CSV, up to 100 rows. The builder shows what it found and
  what is wrong with each row it couldn't read before adding them (`shared/import.ts`).
- **Courses list.** Courses have a cover picture (one of the course's images), a category and
  tags. The list groups by category, searches titles and tags, and shows covers; so does My
  training in Turnfin Me.
- **Review comments.** Trainers and authors comment on the draft, on a lesson or the course as a
  whole (`training_review_comments`), and mark them done. Comments are kept, never deleted; done
  ones show for 30 days.
- **Version notes and retakes.** Publishing asks what changed. Learners who start or are part-way
  through a later version see the note on the course page. **Ask everyone who finished to take it
  again** (needs Manage, because it assigns) gives the new version to everyone whose latest finished
  assignment is older and who has nothing open on the course, within the publisher's assign scope,
  with an optional due date; each is audited.

## Compliance autopilot (e-learning, phase 4)

A **training rule** says who must take a course and how often, so nobody assigns
the same course by hand. One rule per course (`training_rules`), owned by
Training. Pages: **Rules** (`/training/rules`), **Matrix** (`/training/matrix`)
and **Check a certificate** (`/training/check`).

- **Who**: positions, roles, departments and sites, each "any" when empty. A
  person matches when they match every list that has something in it. Someone
  with no sites works everywhere, so a site rule covers them. Leavers are skipped.
- **When**: days to finish (1 to 365) and, optionally, take it again every N
  months (1 to 120), assigned a set number of days before it runs out (0 to 180).
  A renewal is due on the renewal date, or the usual days to finish if that has
  already passed.
- **The run** (`features/compliance/server/engine.ts`): every morning at 05:30
  UTC from the Vercel cron (`/api/cron/training`, `CRON_SECRET`), and straight
  after a rule is saved, restarted or "Run all rules now". For each person it
  covers with nothing open on the course, it assigns when they never finished it
  or are due again. One transaction per rule with a row lock on the course, so two
  runs never assign twice. Assignments carry `ruleId`, no assigner and the name
  "Turnfin (training rule)", with an audit row each. A course with nothing
  published waits.
- **Excused**: cancelling an assignment the rule made excuses that person until
  the course is next due (or until they finish it). Cancelling a hand-assigned
  one excuses nothing. Pausing a rule stops new assignments and keeps the old;
  removing one deletes only the rule.
- **Who may change rules**: Assign training everywhere (the Manage level, not
  limited to some sites), because a rule reaches everyone it covers. Anyone with
  Training access reads them.
- **Matrix**: people the viewer's `training.records.read` covers against every
  course with a rule that covers them: done, due again soon (60 days), to do,
  overdue, awaiting sign-off, out of date, not assigned yet or excused, with
  "in date" counts per course and person. Filters by site, department and course;
  **Download for Excel** sends the same as a CSV (cells that look like formulas
  are quoted).
- **Certificates**: finished training has a certificate in Turnfin Me with a
  12-character code (`XXXX-XXXX-XXXX`, no 0/O/1/I/L), made the first time it is
  shown and never changed (`TrainingAssignment.certificateCode`). **Check a
  certificate** finds the person, course, date and who signed it off; it shows
  nothing else about them.

## Skills on the job (e-learning, phase 5)

Four pieces for the training that happens on the pool deck and in the
classroom rather than on a phone. All of them are Training's own tables;
nothing here reads another module.

- **Practical checklists**: a course that a trainer signs off in person can have
  up to 40 steps to watch for (`TrainingCourse.observation`), each optionally
  **Must be seen**. Built under **Practical checklist** in the course builder
  (Author level). In **Sign-off**, **Observe** opens a tablet page
  (`/training/sign-off/[id]`): every step is marked Met, Not yet or Not needed
  (a must-see step can't be Not needed), with a note on any step. **Sign off**
  needs every step marked and none Not yet; **Send back** stores the marks and,
  unless the trainer writes more, sends the steps not met yet as what to
  practise. The marks are kept on the assignment (`TrainingAssignment.observation`)
  and shown on the person's record and in Turnfin Me. Up to 6 **photos**
  (JPEG, PNG or WebP, 4 MB each) can be added while it waits for sign-off
  (`training_evidence`); they are read with `training.records.read` for that
  person (`/training/evidence/[id]`) and never sent to Turnfin Me.
- **Learning paths** (`/training/paths`): courses in order, each due a number
  of days after the start date (0 to 365, up to 30 courses). Building them is
  the Author level. **Put people on it** (Assign training) assigns every course
  they haven't finished or got open, due from the date they start, and links
  each assignment to the enrolment (`pathEnrolmentId`). A person is on a path
  once at a time. **Take off** cancels the courses the path gave them that they
  haven't handed in. Changing a path later doesn't change what people on it were
  given. Progress per person: done, open, overdue, or missing (cancelled).
- **Sessions** (`/training/sessions`): a classroom or poolside session on a
  date and time (Irish time), at a site and room, with a trainer, an optional
  number of places, an optional course it completes and the qualification whose
  hours it counts. Planning and booking need Assign training for those people;
  the **register** opens an hour before the start and needs Sign off training
  for them. **Close the register** (after the start, everyone marked, never by
  someone it would credit) credits each attendee the session's minutes as
  in-service hours, completes its course for them (creating the assignment if
  they had none) and records the course's qualification. Absent people get
  nothing. Cancelling keeps the bookings on record. Closed and cancelled
  sessions can't change.
- **In-service hours** (`/training/hours`): the Author level sets how many hours
  a qualification needs over a rolling window (for example a pool lifeguard
  qualification, 20 hours in 12 months; `training_hour_targets`). Hours come from
  closed registers or are logged by hand (Sign off training for those people,
  never yourself, never a day to come). Only hours logged against that
  qualification count, and only for people holding it in date. A wrong entry is
  removed with a reason (stamped, not deleted).

Turnfin Me shows the person their own paths, sessions, hours and what the
trainer will watch for on a practical (`training/plan`, and `practical` on
`training/{id}`). The home page shows **Registers to close** to trainers.
Every change writes an audit row (`TrainingSession`, `TrainingHours`,
`TrainingHourTarget`, `TrainingPath`, `TrainingPathEnrolment`,
`TrainingEvidence`). HR's subject export includes them as `trainingOnTheJob`.

Not built yet from the plan: reminders before a session, waiting lists for a
full session, and recurring sessions.

## The learner's own space (e-learning, phase 6)

Everything here is in Turnfin Me, for the signed-in person's own training only.
Work never shows anyone's notes, refreshers or streaks.

- **Search** (`training/search?q=`): every course and lesson the person has
  (not cancelled), on the version they take: titles, the course summary,
  category and tags, and all the words in a lesson (text, scenes, cards,
  checklist items). Every word must match; a word in a title ranks higher. Up to
  10 courses and 30 lessons, with the text around the first match.
- **Bookmarks and private notes** on a lesson (`training_lesson_notes`, up to
  2,000 characters), saved from the lesson player; **Saved** lists them. Clearing
  both removes the row. The audit row names the lesson, never the note's words.
  HR's subject export includes them as `trainingLearner`.
- **My record** (`training/record`): every course with its status, dates, who
  signed it off, the version, the best exam score and the certificate; learning
  paths, sessions attended and in-service hours. Printed or downloaded as a CSV
  made on the phone.
- **Course catalogue**: an author ticks **Open in the course catalogue** in a
  course's settings (`TrainingCourse.selfEnrol`). Published, unretired courses
  with it show in **Find a course**, with lessons, minutes, whether there is an
  exam or a sign-off, the qualification and the average rating once three people
  have rated it. **Enrol** makes the same assignment a trainer would, with no due
  date, audited as "Enrolled themselves"; one already open is opened instead.
  The course list in Work marks them "in the catalogue".
- **Ratings**: once a course is finished or waiting for sign-off, the person
  rates it 1 to 5 stars and can say what was unclear (`training_feedback`, one
  per assignment, changeable, audited). The builder shows **What learners said**:
  the average, how many gave each rating and the comments, newest first, never
  with names.
- **Daily refreshers** (`training/refresher`): a practice question answered
  wrong (a Quiz lesson or a knowledge check) becomes a card due the next day
  (`training_refresher_cards`). A **passed** exam's wrong answers do too; a
  failed paper adds nothing, so no exam question leaks before a pass. Each day
  offers up to 5: cards due, lowest box first, topped up with questions from
  finished courses. A right answer moves a card up a box (due again in 1, 2, 4,
  8 or 16 days); a wrong one sends it back to box 1. Like practice, only right or
  not and the explanation are sent, never the right answer. Answers are counted
  per day (`training_refresher_days`) and are not audited, like practice checks.
- **Streaks and badges**: the streak counts days in a row with a lesson finished
  or a refresher answered (today, or up to yesterday while today is open), and
  keeps the best. Badges are worked out each time, never stored: first, five and
  ten courses; passing an exam first time; full marks; three, seven and thirty
  days in a row; 50 refresher answers; in-service hours met; a path finished.
- **Text size and reading aloud** (More › Text size and reading aloud): three
  text sizes and a normal or slower reading speed, kept on that phone only.
  **Read aloud** on a lesson uses the phone's own voice; nothing is sent anywhere.

## Insight: analytics, reports and audit packs (e-learning, phase 7)

All of it is in Work, worked out from the records each time (no tables of its
own), and limited to the people the reader's `training.records.read` covers
through the policy engine (`subjectsFor`, `requireCapFor`). Anyone with Training
access may open it. Cancelled training is never counted.

- **Course insight** (`/training/courses/[id]/insight`, the course's **Insight**
  button), filtered by site and by when people were given it:
  - figures: completed, overdue now, the middle number of days to finish (from
    being given it, and from the first lesson), on time (of those completed with
    a due date), passed the exam first time and the course's rating (everyone
    who rated it, never names);
  - **How far people get**: given, started, finished every lesson (or tested
    out), passed the exam, waiting for sign-off, completed;
  - **Where people stop**: each lesson of the published version with how many
    finished it and how many still taking the course have it as their next
    lesson; the most-stopped lesson is marked;
  - **Final exam**: first time and overall pass rates, the middle best score and
    sittings to pass, linking to the most-missed questions;
  - **By site** (someone at two sites counts at both) and **People**, overdue
    first, with a download for Excel.
- **Reports** (`/training/reports`), filtered by site and department: open,
  overdue, waiting for sign-off and completed in the past 30 days; overdue **by
  site** and **by line manager** (HR's manager link; "No manager set" when none);
  every overdue course by person, longest late first; and each course's numbers.
  The overdue list and the course table download for Excel
  (`/training/reports/export?kind=overdue|courses`).
- **Audit packs**, to print or save as a PDF:
  - a person (`/training/people/[id]/audit`, **Audit pack** on their record):
    qualifications, then each course with who gave it and when, the version
    taught, each lesson finished with its time, every exam sitting with its
    score, the practical checklist and sign-off, evidence and the certificate
    code; in-service hours, sessions, and the audit trail of their training and
    qualifications. A 404 for anyone the reader does not cover;
  - a course (`/training/courses/[id]/audit`, from its insight page, with the
    same filters): its versions and change notes, who must take it, everyone
    covered with the version taught, result, sign-off and certificate, and the
    audit trail of the course and that training.

## The deeper builder (e-learning, phase 8)

Owner request, 16 October 2026: a builder for any kind of training. Lesson and
question kinds are checked by the database, so the migration
`20261119120000_training_builder_pro` widens both checks; everything else is
additive (three defaulted course columns and `training_submissions`).

- **New lessons** (Add lesson):
  - **Sort into groups**: 2 to 4 named groups and up to 24 things to sort.
    Turnfin Me mixes them up, the learner places each one and checks; practice,
    sent whole.
  - **Explore a picture**: a picture (one of the course's images) with up to 12
    numbered spots, each with a name and text. Placed by tapping the picture in
    the builder; Me shows 44px markers and the same spots as a list.
  - **Hand in work**: the task in the lesson text, then a written answer and a
    photo or PDF, each Must, May or None, and optionally "A trainer checks it".
    The answer goes to `training_submissions` (one a lesson, handed in again
    until accepted). With a check the lesson finishes only when someone with
    `training.signoff` for the person accepts it (never their own); returning
    it sends feedback. Both are on the Sign-off page and audited (`hand-in`,
    `accept-work`, `return-work`). Photos are shrunk on the phone to 1600px;
    PDFs up to 3 MB.
  - **Slides or interactive**: a link from Google Slides, Docs, Sheets or Forms,
    a Google Drive file, Canva, Genially, H5P or Microsoft Forms, played in the
    lesson. `embedFor` turns the share link into the embed address; anything
    else is refused.
- **New questions**: **Number** (an answer, a margin either way and a unit;
  a comma or full stop both work) and **Short answer** (every answer accepted,
  forgiving case and spacing). Both are marked on the server and never send the
  answer; both paste in from a spreadsheet (`Number`: Option A the answer, B the
  margin, C the unit; `Short answer`: each option an accepted answer).
- **New blocks in lesson text**: **Tabs**, **Video** (YouTube or Vimeo inside
  a reading) and **File to download** (one of the course's files as a button).
  Copying a course or lesson copies the file too.
- **Course settings**: **Lessons in order** (each lesson opens when the one
  before is done; checked on the server), **Finish these first** (up to 5 other
  courses that must be completed; a course can't need itself and two courses
  can't need each other), and **Offer as a template** (shown first under Start
  from a template, copied whole).
- **Make it better**: on the course's start panel, advice that never blocks
  publishing (`qualityTips`): pictures with no description, readings over 10
  minutes, recordings with no transcript, videos with no minutes, big flashcard
  decks, long lesson names, sections with nothing that checks understanding,
  exam sections with no questions, questions with no "why", courses over an
  hour, and all-reading courses.

## Offline in Turnfin Me (e-learning, phase 9)

Owner go-ahead, 16 October 2026. For plant rooms, basements and pool decks
with no signal. No migration.

- **Save for offline** on a course in Me keeps its outline, every lesson and
  every file it uses (lesson files, pictures, scene and card pictures, the
  cover) in the phone's IndexedDB, plus My training. Each saved course shows its
  size and date, with **Bring up to date** and **Remove**; More > **Saved for
  offline** lists them. A fresh answer from Turnfin replaces the copy.
- **With no signal**, a saved course opens from the phone. Finishing a lesson,
  a lesson note or bookmark, and handed-in work wait in an outbox and show at
  once in the saved copy (ticked, the next lesson opened when lessons go in
  order, work shown as "Waiting for signal"). A line under the top row says
  the phone is offline and how many changes wait.
- **Back online**, the outbox is sent oldest first, then the course is brought
  up to date. It stops on no signal, a sign-in or too many requests and tries
  again later (on reconnect, and when the app comes back to the front); one
  Turnfin refuses (a lesson locked meanwhile, accepted work) is dropped and
  listed, so the person can do it again.
- **When it was done**: `complete` and `hand-in` take the phone's time (`at`).
  `offlineTime` (`features/me/server/offline.ts`) keeps it only within 14 days, after the
  course was assigned and not in the future (two minutes ahead counts as now);
  the audit summary adds "offline at 16 Oct, 10:42". Otherwise the server time
  is used.
- **Still needs a connection**: practice questions, knowledge checks, the exam
  (all marked on the server, and keys never reach the phone), videos and
  slides. Opening one of those offline says so.
- **Privacy**: only material the person saved and their own unsent changes are
  kept, for 30 days at most. Sign out removes everything (after warning if
  changes are still waiting), and so does a different email signing in on the
  same phone (`claim`). The session token stays in the tab only, as before.
- **Pages**: `public/sw.js`, registered in production builds, keeps the app's
  own scripts (cache first) and pages (network first, then the copy, then
  `/offline`). It never touches the staff API. Saving a course loads its pages
  once so they are kept.

## Drafting a course from a document with AI

Owner ask, 19 October 2026: turn SOPs and other documents into training. No
migration. Feature `ai-draft`; switched on by `ANTHROPIC_API_KEY` (unset, the
button explains it isn't switched on and nothing is sent).

- **Where**: Training > Courses > **Draft from a document**, beside Start from
  a template, for the Author level (`who.manage`). The person gives a PDF, a
  Word file (.docx), a text file or a photo of the pages (up to 4 MB), or
  pastes the text, and can name the course and turn off the practice questions
  or the final exam.
- **What happens**: `src/app/training/courses/draft/route.ts` (a route handler,
  so documents can be larger than a server action allows and the call can run
  up to five minutes) passes it to `draftCourse`. Claude reads the document and
  answers in a fixed JSON shape (`server/schema.ts`): sections of reading,
  flashcard and checklist lessons, and single, multiple and true-or-false
  questions. `toCourse` turns that into the builder's own lessons through the
  same cleaning an author's edit goes through, drops anything incomplete and
  lists it, adds a "Check yourself" quiz after each section with two or more
  questions, and the exam (the usual defaults) when there are five or more.
- **It is never live by itself**: the course is created unpublished, with a
  review comment from "<name> (AI draft)" saying to read every lesson against
  the document, plus the AI's own notes (gaps, unclear steps, names replaced
  by roles) and anything left out. Publishing works as for any course.
- **Rules kept**: the prompt keeps every rule, number and step as written,
  never invents, and swaps named people, phone numbers and emails for roles.
  Each draft writes an audit row (`ai-draft`). Ten drafts an hour per person,
  counted from those review comments.
- **Privacy**: the document goes to Anthropic's API only (which doesn't train
  on API data); Turnfin keeps the course, not the document. The dialog asks
  people to leave out anything personal.
- **Setup**: add `ANTHROPIC_API_KEY` (from console.anthropic.com) to the Work
  project's environment variables for Production and Preview.

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
