-- AlterTable
ALTER TABLE "StaffRole" ADD COLUMN     "home" TEXT NOT NULL DEFAULT 'overview';

-- Three permissions were split out of two broader ones. Every role that held
-- the broad one keeps everything it could do yesterday:
--   attendance.mark      -> also attendance.cover
--   progression.assess   -> also progression.complete and assessments.run
UPDATE "StaffRole"
SET "permissions" = array_append("permissions", 'attendance.cover')
WHERE 'attendance.mark' = ANY("permissions")
  AND NOT ('attendance.cover' = ANY("permissions"));

UPDATE "StaffRole"
SET "permissions" = array_append("permissions", 'progression.complete')
WHERE 'progression.assess' = ANY("permissions")
  AND NOT ('progression.complete' = ANY("permissions"));

UPDATE "StaffRole"
SET "permissions" = array_append("permissions", 'assessments.run')
WHERE 'progression.assess' = ANY("permissions")
  AND NOT ('assessments.run' = ANY("permissions"));

-- A role that can take its own registers is an instructor's, and an
-- instructor's day starts on the deck. Admins keep the overview.
UPDATE "StaffRole"
SET "home" = 'today'
WHERE 'attendance.mark' = ANY("permissions")
  AND NOT ('staff.manage' = ANY("permissions"));
