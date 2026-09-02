-- Kinds of assessment, per programme, and a kind on every session. Nullable,
-- because a session already existed when this landed and nobody has said what
-- kind it was; new sessions are required to have one by the action.

-- CreateTable
CREATE TABLE "AssessmentType" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentType_programmeId_name_key" ON "AssessmentType"("programmeId", "name");

-- CreateIndex
CREATE INDEX "AssessmentType_programmeId_sortOrder_idx" ON "AssessmentType"("programmeId", "sortOrder");

-- AddForeignKey
ALTER TABLE "AssessmentType" ADD CONSTRAINT "AssessmentType_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "AssessmentSession" ADD COLUMN "typeId" TEXT;

-- CreateIndex
CREATE INDEX "AssessmentSession_typeId_idx" ON "AssessmentSession"("typeId");

-- AddForeignKey
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AssessmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
