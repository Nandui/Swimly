-- AlterTable
ALTER TABLE "StaffRole" ADD COLUMN     "screens" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Every existing role keeps every screen it could open yesterday, which
-- was all of them; then a role whose day starts on the deck and that holds
-- no keys is cut down to the deck alone, which is what an instructor role
-- is for. An admin can widen it again from the Roles page.
UPDATE "StaffRole"
SET "screens" = ARRAY[
  'overview', 'today', 'students', 'courses', 'together', 'assessments',
  'programmes', 'staff', 'roles', 'clubs', 'activity'
];

UPDATE "StaffRole"
SET "screens" = ARRAY['today']
WHERE "home" = 'today'
  AND NOT ('staff.manage' = ANY("permissions"))
  AND NOT ('roles.manage' = ANY("permissions"));
