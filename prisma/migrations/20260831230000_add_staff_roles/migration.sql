-- Roles become data rather than an enum, carrying an explicit permission list.
--
-- Deliberately additive. "User"."role" is left in place and still populated,
-- because the running production deployment reads it and shares this database:
-- dropping it here would break the live app between this migration and the
-- next release. It goes in a later migration, once production is serving the
-- code that reads "staffRoleId".

-- CreateTable
CREATE TABLE "StaffRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffRole_name_key" ON "StaffRole"("name");

-- CreateIndex
CREATE INDEX "StaffRole_sortOrder_idx" ON "StaffRole"("sortOrder");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "staffRoleId" TEXT;

-- CreateIndex
CREATE INDEX "User_staffRoleId_idx" ON "User"("staffRoleId");

-- AddForeignKey
-- Restrict, not SetNull: an account with no role cannot sign in, so deleting a
-- role out from under its holders would lock them out silently.
ALTER TABLE "User"
    ADD CONSTRAINT "User_staffRoleId_fkey"
    FOREIGN KEY ("staffRoleId") REFERENCES "StaffRole"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- The three roles the app shipped with, so every existing account lands
-- somewhere with exactly the access it had a moment ago. They are editable and
-- renameable; isSystem only stops them being deleted.
INSERT INTO "StaffRole" ("id", "name", "description", "permissions", "isSystem", "sortOrder", "createdAt", "updatedAt")
VALUES
    (
        'staffrole_system_viewer',
        'Viewer',
        'Can look things up and change nothing. Reception, or a duty manager.',
        ARRAY[]::TEXT[],
        true,
        0,
        NOW(),
        NOW()
    ),
    (
        'staffrole_system_instructor',
        'Instructor',
        'Registers, assessments, swimmers and enrolments. Not the curriculum.',
        ARRAY['students.manage', 'enrolment.manage', 'attendance.mark', 'progression.assess']::TEXT[],
        true,
        1,
        NOW(),
        NOW()
    ),
    (
        'staffrole_system_admin',
        'Admin',
        'Everything, including the timetable, the curriculum and these accounts.',
        ARRAY[
            'students.manage',
            'enrolment.manage',
            'attendance.mark',
            'attendance.markAny',
            'progression.assess',
            'progression.override',
            'courses.manage',
            'curriculum.manage',
            'staff.manage',
            'roles.manage',
            'activity.view'
        ]::TEXT[],
        true,
        2,
        NOW(),
        NOW()
    );

-- Backfill every existing account from the enum it already carries.
UPDATE "User" SET "staffRoleId" = 'staffrole_system_admin'      WHERE "role" = 'ADMIN';
UPDATE "User" SET "staffRoleId" = 'staffrole_system_instructor' WHERE "role" = 'INSTRUCTOR';
UPDATE "User" SET "staffRoleId" = 'staffrole_system_viewer'     WHERE "role" = 'VIEWER';
