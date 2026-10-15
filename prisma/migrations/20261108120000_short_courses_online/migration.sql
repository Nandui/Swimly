-- Short courses online booking (phase 2, 15 October 2026; docs/short-courses.md). Additive only.
-- AlterTable
ALTER TABLE "short_courses_courses" ADD COLUMN     "bookOnline" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "short_courses_participants" ADD COLUMN     "callBy" TIMESTAMP(3),
ADD COLUMN     "callTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "phone2" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "short_courses_participants_reference_key" ON "short_courses_participants"("reference");

-- CreateIndex
CREATE INDEX "short_courses_participants_source_payment_status_idx" ON "short_courses_participants"("source", "payment", "status");
