-- Staff profile (owner decision, 8 October 2026): positions kept in Admin with the qualifications
-- each needs, and each person's position and employment details. Additive only.


-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contractMinutes" INTEGER,
ADD COLUMN     "contractType" TEXT,
ADD COLUMN     "endedOn" DATE,
ADD COLUMN     "payrollNumber" TEXT,
ADD COLUMN     "positionId" TEXT;

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionQualification" (
    "positionId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,

    CONSTRAINT "PositionQualification_pkey" PRIMARY KEY ("positionId","typeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Position_orgId_name_key" ON "Position"("orgId", "name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionQualification" ADD CONSTRAINT "PositionQualification_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionQualification" ADD CONSTRAINT "PositionQualification_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "QualificationType"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE INDEX "User_positionId_idx" ON "User"("positionId");
ALTER TABLE "User" ADD CONSTRAINT "User_contractType_check" CHECK ("contractType" IS NULL OR "contractType" IN ('full-time', 'part-time', 'casual', 'seasonal'));
ALTER TABLE "User" ADD CONSTRAINT "User_contractMinutes_check" CHECK ("contractMinutes" IS NULL OR "contractMinutes" BETWEEN 0 AND 4800);
ALTER TABLE "Position" ADD CONSTRAINT "Position_name_check" CHECK (length(btrim("name")) BETWEEN 2 AND 60);

-- Every job title already typed becomes a position, and its holders hold it.
INSERT INTO "Position" ("id", "orgId", "name", "updatedAt")
SELECT 'pos_' || md5(u."orgId" || '|' || lower(btrim(u."jobTitle"))), u."orgId", min(btrim(u."jobTitle")), CURRENT_TIMESTAMP
FROM "User" u
WHERE u."orgId" IS NOT NULL AND u."jobTitle" IS NOT NULL AND length(btrim(u."jobTitle")) BETWEEN 2 AND 60
GROUP BY u."orgId", lower(btrim(u."jobTitle"))
ON CONFLICT DO NOTHING;

UPDATE "User" u SET "positionId" = p."id"
FROM "Position" p
WHERE u."positionId" IS NULL AND u."orgId" = p."orgId" AND u."jobTitle" IS NOT NULL AND lower(btrim(u."jobTitle")) = lower(p."name");
