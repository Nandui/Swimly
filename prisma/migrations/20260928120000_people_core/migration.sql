-- People core: organisation, departments, line managers, additional role
-- assignments, qualifications, superadmin flag and shared-device session fields.
-- Additive only: the development and production database are the same Postgres.

ALTER TABLE "StaffRole" ADD COLUMN     "restricted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User" ADD COLUMN     "isSuperadmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "orgId" TEXT,
ADD COLUMN     "passwordAt" TIMESTAMP(3),
ADD COLUMN     "pinHash" TEXT,
ADD COLUMN     "primaryClubId" TEXT,
ADD COLUMN     "startedOn" DATE;

ALTER TABLE "Club" ADD COLUMN     "orgId" TEXT;

CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clubId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserDepartment" (
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDepartment_pkey" PRIMARY KEY ("userId","departmentId")
);

CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scopeKind" TEXT NOT NULL DEFAULT 'all',
    "scopeId" TEXT NOT NULL DEFAULT '',
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QualificationType" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "validityMonths" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualificationType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Qualification" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "issuedOn" DATE NOT NULL,
    "expiresOn" DATE,
    "reference" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Qualification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organisation_slug_key" ON "Organisation"("slug");

CREATE INDEX "Department_orgId_sortOrder_idx" ON "Department"("orgId", "sortOrder");

CREATE UNIQUE INDEX "Department_orgId_name_key" ON "Department"("orgId", "name");

CREATE INDEX "UserDepartment_departmentId_idx" ON "UserDepartment"("departmentId");

CREATE INDEX "RoleAssignment_roleId_idx" ON "RoleAssignment"("roleId");

CREATE UNIQUE INDEX "RoleAssignment_userId_roleId_scopeKind_scopeId_key" ON "RoleAssignment"("userId", "roleId", "scopeKind", "scopeId");

CREATE UNIQUE INDEX "QualificationType_orgId_name_key" ON "QualificationType"("orgId", "name");

CREATE INDEX "Qualification_userId_idx" ON "Qualification"("userId");

CREATE INDEX "Qualification_orgId_expiresOn_idx" ON "Qualification"("orgId", "expiresOn");

CREATE INDEX "User_managerId_idx" ON "User"("managerId");

CREATE INDEX "User_orgId_idx" ON "User"("orgId");

ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "Department" ADD CONSTRAINT "Department_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Department" ADD CONSTRAINT "Department_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "StaffRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "QualificationType" ADD CONSTRAINT "QualificationType_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "QualificationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Club" ADD CONSTRAINT "Club_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Scope kinds are code (see src/lib/people/scopes.ts); keep the column honest.
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_scopeKind_check"
  CHECK ("scopeKind" IN ('all','site','department','reports'));
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_scopeId_check"
  CHECK (("scopeKind" IN ('all','reports') AND "scopeId" = '') OR ("scopeKind" IN ('site','department') AND "scopeId" <> ''));
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_not_self_check" CHECK ("managerId" IS NULL OR "managerId" <> "id");
ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_expiry_check" CHECK ("expiresOn" IS NULL OR "expiresOn" >= "issuedOn");
ALTER TABLE "QualificationType" ADD CONSTRAINT "QualificationType_validity_check" CHECK ("validityMonths" IS NULL OR "validityMonths" BETWEEN 1 AND 240);

-- Backfill: every existing site and account belongs to LeisureWorld. Idempotent.
INSERT INTO "Organisation" ("id", "name", "slug", "updatedAt")
VALUES ('org_leisureworld', 'LeisureWorld', 'leisureworld', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
UPDATE "Club" SET "orgId" = (SELECT "id" FROM "Organisation" WHERE "slug" = 'leisureworld') WHERE "orgId" IS NULL;
UPDATE "User" SET "orgId" = (SELECT "id" FROM "Organisation" WHERE "slug" = 'leisureworld') WHERE "orgId" IS NULL;

-- Starter qualification types (editable; archive rather than delete).
INSERT INTO "QualificationType" ("id", "orgId", "name", "validityMonths", "updatedAt")
SELECT v.id, o."id", v.name, v.months, CURRENT_TIMESTAMP
FROM "Organisation" o
CROSS JOIN (VALUES
  ('qt_nplq', 'National Pool Lifeguard Qualification (NPLQ)', 24),
  ('qt_first_aid', 'First aid', 36),
  ('qt_swim_teacher', 'Swim teacher', 36),
  ('qt_safeguarding', 'Safeguarding / child protection', 36)
) AS v(id, name, months)
WHERE o."slug" = 'leisureworld'
ON CONFLICT ("orgId", "name") DO NOTHING;
