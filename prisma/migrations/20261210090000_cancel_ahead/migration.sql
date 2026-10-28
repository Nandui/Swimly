-- AlterTable
ALTER TABLE "ClassCancellation" ADD COLUMN     "closureId" TEXT;

-- CreateIndex
CREATE INDEX "ClassCancellation_closureId_idx" ON "ClassCancellation"("closureId");
