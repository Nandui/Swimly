-- Training e-learning, phase 4 (owner request, 15 October 2026; docs/training.md):
-- compliance autopilot. Additive only: one new training_* table and two
-- nullable columns on assignments. Existing assignments are untouched.

-- Who must take a course, by role, department, site and position, and how often
CREATE TABLE "training_rules" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "roleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "departmentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "siteIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "positionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "dueDays" INTEGER NOT NULL DEFAULT 30,
    "renewMonths" INTEGER,
    "renewLeadDays" INTEGER NOT NULL DEFAULT 30,
    "pausedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "training_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "training_rules_dueDays_check" CHECK ("dueDays" BETWEEN 1 AND 365),
    CONSTRAINT "training_rules_renewMonths_check" CHECK ("renewMonths" IS NULL OR "renewMonths" BETWEEN 1 AND 120),
    CONSTRAINT "training_rules_renewLeadDays_check" CHECK ("renewLeadDays" BETWEEN 0 AND 180)
);
CREATE UNIQUE INDEX "training_rules_courseId_key" ON "training_rules"("courseId");
CREATE INDEX "training_rules_orgId_idx" ON "training_rules"("orgId");
ALTER TABLE "training_rules" ADD CONSTRAINT "training_rules_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Which rule gave an assignment, and the code that checks its certificate
ALTER TABLE "TrainingAssignment" ADD COLUMN "ruleId" TEXT;
ALTER TABLE "TrainingAssignment" ADD COLUMN "certificateCode" TEXT;
CREATE UNIQUE INDEX "TrainingAssignment_certificateCode_key" ON "TrainingAssignment"("certificateCode");
