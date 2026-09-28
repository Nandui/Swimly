-- Roles with one level for each module (docs/how-turnfin-works.md). Additive
-- only: new columns with defaults; existing roles keep working unchanged until
-- they are converted.

ALTER TABLE "StaffRole" ADD COLUMN "levels" JSONB;
ALTER TABLE "StaffRole" ADD COLUMN "extras" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "StaffRole" ADD COLUMN "homeName" TEXT;
ALTER TABLE "User" ADD COLUMN "siteIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
