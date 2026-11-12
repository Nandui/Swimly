-- The role an area's staff line asks for (Admin, Areas). Additive: older lines stay empty and
-- take the role that needs their qualification.
ALTER TABLE "SiteAreaStaffing" ADD COLUMN "positionId" TEXT;
ALTER TABLE "SiteAreaStaffing" ADD CONSTRAINT "SiteAreaStaffing_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;
