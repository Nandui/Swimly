-- Training e-learning, phase 1 (owner request, 15 October 2026; docs/training.md): courses
-- built from sections and lessons, published as frozen versions, with files and each
-- learner's progress. Additive only: five new training_* tables and two new nullable
-- columns. Existing courses and assignments are untouched and keep working as before.

-- AlterTable
ALTER TABLE "TrainingCourse" ADD COLUMN "publishedVersionId" TEXT;

-- AlterTable
ALTER TABLE "TrainingAssignment" ADD COLUMN "versionId" TEXT;

-- CreateTable
CREATE TABLE "training_sections" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_lessons" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'READING',
    "title" TEXT NOT NULL,
    "body" JSONB,
    "videoUrl" TEXT NOT NULL DEFAULT '',
    "fileId" TEXT,
    "minutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_lessons_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "training_lessons_kind_check" CHECK ("kind" IN ('READING', 'VIDEO', 'FILE'))
);

-- CreateTable
CREATE TABLE "training_course_versions" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "outline" JSONB NOT NULL,
    "lessonCount" INTEGER NOT NULL,
    "publishedById" TEXT,
    "publishedByName" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_course_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_files" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "addedById" TEXT,
    "addedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_lesson_progress" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_sections_courseId_position_idx" ON "training_sections"("courseId", "position");
CREATE INDEX "training_lessons_sectionId_position_idx" ON "training_lessons"("sectionId", "position");
CREATE UNIQUE INDEX "training_course_versions_courseId_number_key" ON "training_course_versions"("courseId", "number");
CREATE INDEX "training_files_courseId_idx" ON "training_files"("courseId");
CREATE UNIQUE INDEX "training_lesson_progress_assignmentId_lessonId_key" ON "training_lesson_progress"("assignmentId", "lessonId");

-- AddForeignKey
ALTER TABLE "training_sections" ADD CONSTRAINT "training_sections_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_lessons" ADD CONSTRAINT "training_lessons_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "training_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_course_versions" ADD CONSTRAINT "training_course_versions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_files" ADD CONSTRAINT "training_files_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_lesson_progress" ADD CONSTRAINT "training_lesson_progress_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
