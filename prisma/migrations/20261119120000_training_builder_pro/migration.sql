-- Training e-learning, phase 8 (owner request, 16 October 2026; docs/training.md):
-- a deeper course builder. Additive only: four lesson kinds and two question
-- kinds added to the existing checks, three defaulted columns and one new
-- training_* table. Existing courses and assignments are untouched.

-- Sort into groups, Explore a picture, Hand in work, and Slides or interactive lessons
ALTER TABLE "training_lessons" DROP CONSTRAINT "training_lessons_kind_check";
ALTER TABLE "training_lessons" ADD CONSTRAINT "training_lessons_kind_check" CHECK ("kind" IN ('READING', 'VIDEO', 'FILE', 'QUIZ', 'SCENARIO', 'FLASHCARDS', 'CHECKLIST', 'AUDIO', 'SORTING', 'EXPLORE', 'ASSIGNMENT', 'EMBED'));

-- Number and short-answer questions
ALTER TABLE "training_questions" DROP CONSTRAINT "training_questions_kind_check";
ALTER TABLE "training_questions" ADD CONSTRAINT "training_questions_kind_check" CHECK ("kind" IN ('SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'ORDER', 'MATCH', 'FILL_BLANK', 'HOTSPOT', 'NUMBER', 'SHORT_ANSWER'));

-- Lessons taken in order, courses to finish first, and courses offered as templates
ALTER TABLE "TrainingCourse" ADD COLUMN "lessonsInOrder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TrainingCourse" ADD COLUMN "prerequisiteIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "TrainingCourse" ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false;

-- Work handed in on a Hand in work lesson, and a trainer's review of it
CREATE TABLE "training_submissions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "versionId" TEXT,
    "text" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT,
    "mime" TEXT,
    "size" INTEGER,
    "bytes" BYTEA,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "feedback" TEXT NOT NULL DEFAULT '',
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_submissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "training_submissions_status_check" CHECK ("status" IN ('SUBMITTED', 'ACCEPTED', 'RETURNED'))
);
CREATE UNIQUE INDEX "training_submissions_assignmentId_lessonId_key" ON "training_submissions"("assignmentId", "lessonId");
CREATE INDEX "training_submissions_orgId_status_idx" ON "training_submissions"("orgId", "status");
ALTER TABLE "training_submissions" ADD CONSTRAINT "training_submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
