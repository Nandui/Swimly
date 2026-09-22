ALTER TABLE "Enrolment"
  ADD COLUMN "readyToMoveAt" TIMESTAMP(3),
  ADD COLUMN "readyToMoveById" TEXT,
  ADD COLUMN "readyToMoveByName" TEXT,
  ADD COLUMN "readyToMoveLevelId" TEXT,
  ADD COLUMN "readyToMoveNote" TEXT;

CREATE INDEX "Enrolment_status_readyToMoveAt_idx" ON "Enrolment"("status", "readyToMoveAt");
