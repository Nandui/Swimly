-- Area needs tied to an activity, and sub-activities at several set times (owner, 21 October 2026). Additive: new nullable columns and empty-list defaults.
-- AlterTable
ALTER TABLE "SiteAreaStaffing" ADD COLUMN "activityTypeId" TEXT,
ADD COLUMN "fromMinutes" INTEGER,
ADD COLUMN "untilMinutes" INTEGER;

-- AlterTable
ALTER TABLE "SubActivity" ADD COLUMN "times" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "RotaAssignmentSub" ADD COLUMN "times" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AddForeignKey
ALTER TABLE "SiteAreaStaffing" ADD CONSTRAINT "SiteAreaStaffing_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "RotaActivityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
