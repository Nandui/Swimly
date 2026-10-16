-- Training e-learning, phase 2 (owner request, 15 October 2026; docs/training.md):
-- quizzes and exams. Additive only: two new training_* tables, two new columns
-- (one nullable, one with a default) and Quiz added to the lesson kinds.
-- Existing courses, versions and assignments are untouched.

-- AlterTable
ALTER TABLE "TrainingCourse" ADD COLUMN "exam" JSONB;

-- AlterTable
ALTER TABLE "TrainingAssignment" ADD COLUMN "examExtraAttempts" INTEGER NOT NULL DEFAULT 0;

-- A Quiz lesson
ALTER TABLE "training_lessons" DROP CONSTRAINT "training_lessons_kind_check";
ALTER TABLE "training_lessons" ADD CONSTRAINT "training_lessons_kind_check" CHECK ("kind" IN ('READING', 'VIDEO', 'FILE', 'QUIZ'));

-- CreateTable
CREATE TABLE "training_questions" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "imageId" TEXT,
    "options" JSONB NOT NULL,
    "explanation" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_questions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "training_questions_kind_check" CHECK ("kind" IN ('SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'ORDER', 'MATCH'))
);

-- CreateTable
CREATE TABLE "training_exam_attempts" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "paper" JSONB NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "correct" INTEGER,
    "total" INTEGER NOT NULL,
    "percent" INTEGER,
    "passed" BOOLEAN,
    "results" JSONB,

    CONSTRAINT "training_exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_questions_sectionId_position_idx" ON "training_questions"("sectionId", "position");
CREATE INDEX "training_questions_courseId_idx" ON "training_questions"("courseId");
CREATE UNIQUE INDEX "training_exam_attempts_assignmentId_number_key" ON "training_exam_attempts"("assignmentId", "number");
CREATE INDEX "training_exam_attempts_versionId_idx" ON "training_exam_attempts"("versionId");

-- AddForeignKey
ALTER TABLE "training_questions" ADD CONSTRAINT "training_questions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_questions" ADD CONSTRAINT "training_questions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "training_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_exam_attempts" ADD CONSTRAINT "training_exam_attempts_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
