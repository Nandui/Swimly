-- Training e-learning, phase 3 (owner request, 15 October 2026; docs/training.md):
-- a richer builder and richer lessons. Additive only: new columns that are
-- nullable or have defaults, one new training_* table, and new lesson and
-- question kinds added to the existing checks. Existing courses, versions and
-- assignments are untouched.

-- The settings of a Scenario, Flashcards, Checklist or Audio lesson
ALTER TABLE "training_lessons" ADD COLUMN "data" JSONB;
ALTER TABLE "training_lessons" DROP CONSTRAINT "training_lessons_kind_check";
ALTER TABLE "training_lessons" ADD CONSTRAINT "training_lessons_kind_check" CHECK ("kind" IN ('READING', 'VIDEO', 'FILE', 'QUIZ', 'SCENARIO', 'FLASHCARDS', 'CHECKLIST', 'AUDIO'));

-- Fill in the blanks and pick the spot
ALTER TABLE "training_questions" DROP CONSTRAINT "training_questions_kind_check";
ALTER TABLE "training_questions" ADD CONSTRAINT "training_questions_kind_check" CHECK ("kind" IN ('SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'ORDER', 'MATCH', 'FILL_BLANK', 'HOTSPOT'));

-- A course's cover picture, category and tags
ALTER TABLE "TrainingCourse" ADD COLUMN "coverId" TEXT;
ALTER TABLE "TrainingCourse" ADD COLUMN "category" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TrainingCourse" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- What changed in a version, and whether people who finished an older one take it again
ALTER TABLE "training_course_versions" ADD COLUMN "changeNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "training_course_versions" ADD COLUMN "retake" BOOLEAN NOT NULL DEFAULT false;

-- Review comments on a draft
CREATE TABLE "training_review_comments" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedByName" TEXT,

    CONSTRAINT "training_review_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "training_review_comments_courseId_createdAt_idx" ON "training_review_comments"("courseId", "createdAt");

ALTER TABLE "training_review_comments" ADD CONSTRAINT "training_review_comments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
