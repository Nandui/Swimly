-- AlterTable
ALTER TABLE "incidents_people" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "incidents_people_userId_idx" ON "incidents_people"("userId");

