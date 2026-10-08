-- Tasks parity with the prototype (owner request, 8 October 2026; docs/tasks.md). Additive only.
-- AlterTable
ALTER TABLE "TaskTemplate" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'repeat',
ADD COLUMN     "logMode" TEXT NOT NULL DEFAULT 'form',
ADD COLUMN     "notifyCompletion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyException" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "restricted" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "TaskAction" ADD COLUMN     "followUpTaskId" TEXT;

-- CreateTable
CREATE TABLE "TaskSite" (
    "siteId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'live',
    "area" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Dublin',
    "opening" TEXT NOT NULL DEFAULT '06:00',
    "closing" TEXT NOT NULL DEFAULT '22:00',
    "closedDates" DATE[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSite_pkey" PRIMARY KEY ("siteId")
);

-- CreateTable
CREATE TABLE "TaskScoreSnapshot" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "score" INTEGER,
    "count" INTEGER NOT NULL,
    "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskScoreSnapshot_siteId_date_key" ON "TaskScoreSnapshot"("siteId", "date");

-- AddForeignKey
ALTER TABLE "TaskSite" ADD CONSTRAINT "TaskSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskScoreSnapshot" ADD CONSTRAINT "TaskScoreSnapshot_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: what existing templates already did.
UPDATE "TaskTemplate" SET "kind" = 'adhoc' WHERE "schedules" = '[]'::jsonb;
UPDATE "TaskTemplate" SET "logMode" = 'table' WHERE "minimumRecords" > 1;
UPDATE "TaskTemplate" SET "restricted" = false WHERE cardinality("roleIds") = 0;
