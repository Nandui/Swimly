-- Swimmers the desk adds to Awaiting enrolment by hand (owner request, 20 October 2026). Additive: one new table.
CREATE TABLE "ManualPlacement" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "addedById" TEXT,
    "addedByName" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "removedById" TEXT,
    "removedByName" TEXT,
    "removedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManualPlacement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ManualPlacement_clubId_removedAt_idx" ON "ManualPlacement"("clubId", "removedAt");
CREATE INDEX "ManualPlacement_studentId_idx" ON "ManualPlacement"("studentId");
ALTER TABLE "ManualPlacement" ADD CONSTRAINT "ManualPlacement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManualPlacement" ADD CONSTRAINT "ManualPlacement_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManualPlacement" ADD CONSTRAINT "ManualPlacement_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
