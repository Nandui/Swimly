-- Training e-learning, phase 6 (owner request, 15 October 2026; docs/training.md):
-- the learner's own space in Turnfin Me. Additive only: one defaulted column and
-- new training_* tables. Existing courses and assignments are untouched.

-- Courses staff may enrol themselves on from the catalogue in Turnfin Me
ALTER TABLE "TrainingCourse" ADD COLUMN "selfEnrol" BOOLEAN NOT NULL DEFAULT false;

-- A learner's bookmark and private note on a lesson. Private to them: Work never shows it.
CREATE TABLE "training_lesson_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_lesson_notes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "training_lesson_notes_assignmentId_lessonId_key" ON "training_lesson_notes"("assignmentId", "lessonId");
CREATE INDEX "training_lesson_notes_userId_idx" ON "training_lesson_notes"("userId");
ALTER TABLE "training_lesson_notes" ADD CONSTRAINT "training_lesson_notes_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A learner's rating of a course they finished, and what was unclear. Authors see it without names.
CREATE TABLE "training_feedback" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "versionId" TEXT,
    "rating" INTEGER NOT NULL,
    "unclear" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_feedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "training_feedback_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);
CREATE UNIQUE INDEX "training_feedback_assignmentId_key" ON "training_feedback"("assignmentId");
CREATE INDEX "training_feedback_courseId_idx" ON "training_feedback"("courseId");
ALTER TABLE "training_feedback" ADD CONSTRAINT "training_feedback_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Daily refreshers: one card a question a learner missed, spaced out in boxes 1 to 5
CREATE TABLE "training_refresher_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 1,
    "dueOn" DATE NOT NULL,
    "misses" INTEGER NOT NULL DEFAULT 1,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_refresher_cards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "training_refresher_cards_box_check" CHECK ("box" BETWEEN 1 AND 5)
);
CREATE UNIQUE INDEX "training_refresher_cards_userId_versionId_questionId_key" ON "training_refresher_cards"("userId", "versionId", "questionId");
CREATE INDEX "training_refresher_cards_userId_dueOn_idx" ON "training_refresher_cards"("userId", "dueOn");
ALTER TABLE "training_refresher_cards" ADD CONSTRAINT "training_refresher_cards_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- How many refresher questions a learner answered each day, for their streak
CREATE TABLE "training_refresher_days" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "on" DATE NOT NULL,
    "answered" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "training_refresher_days_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "training_refresher_days_userId_on_key" ON "training_refresher_days"("userId", "on");
