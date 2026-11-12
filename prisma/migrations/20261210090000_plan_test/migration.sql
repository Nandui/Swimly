-- Plan (test) (owner decisions, 29 October 2026; src/modules/plan/README.md). Additive: new tables only.
-- CreateTable
CREATE TABLE "plan_areas" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "lanes" INTEGER NOT NULL DEFAULT 0,
    "departmentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_duties" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT,
    "qualificationTypeId" TEXT,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "defaultMinutes" INTEGER,
    "isBreak" BOOLEAN NOT NULL DEFAULT false,
    "forClasses" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_duties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_duty_tasks" (
    "id" TEXT NOT NULL,
    "dutyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "when" TEXT NOT NULL,
    "atMinutes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plan_duty_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_sessions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "areaId" TEXT,
    "lanes" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "weekdays" INTEGER[],
    "firstDay" TEXT NOT NULL,
    "lastDay" TEXT NOT NULL,
    "skipDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_session_needs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "dutyId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "plan_session_needs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_session_days" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "startMinutes" INTEGER,
    "endMinutes" INTEGER,

    CONSTRAINT "plan_session_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_shifts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_blocks" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "dutyId" TEXT NOT NULL,
    "sessionId" TEXT,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_offs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstDay" TEXT NOT NULL,
    "lastDay" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "byId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_offs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_areas_orgId_siteId_idx" ON "plan_areas"("orgId", "siteId");

-- CreateIndex
CREATE INDEX "plan_duties_orgId_idx" ON "plan_duties"("orgId");

-- CreateIndex
CREATE INDEX "plan_duty_tasks_dutyId_idx" ON "plan_duty_tasks"("dutyId");

-- CreateIndex
CREATE INDEX "plan_sessions_orgId_siteId_lastDay_idx" ON "plan_sessions"("orgId", "siteId", "lastDay");

-- CreateIndex
CREATE INDEX "plan_session_needs_sessionId_idx" ON "plan_session_needs"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "plan_session_days_sessionId_date_key" ON "plan_session_days"("sessionId", "date");

-- CreateIndex
CREATE INDEX "plan_shifts_orgId_siteId_date_idx" ON "plan_shifts"("orgId", "siteId", "date");

-- CreateIndex
CREATE INDEX "plan_shifts_userId_date_idx" ON "plan_shifts"("userId", "date");

-- CreateIndex
CREATE INDEX "plan_blocks_shiftId_idx" ON "plan_blocks"("shiftId");

-- CreateIndex
CREATE INDEX "plan_blocks_sessionId_idx" ON "plan_blocks"("sessionId");

-- CreateIndex
CREATE INDEX "plan_offs_orgId_firstDay_idx" ON "plan_offs"("orgId", "firstDay");

-- CreateIndex
CREATE INDEX "plan_offs_userId_firstDay_idx" ON "plan_offs"("userId", "firstDay");

-- AddForeignKey
ALTER TABLE "plan_areas" ADD CONSTRAINT "plan_areas_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "plan_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_duty_tasks" ADD CONSTRAINT "plan_duty_tasks_dutyId_fkey" FOREIGN KEY ("dutyId") REFERENCES "plan_duties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_sessions" ADD CONSTRAINT "plan_sessions_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "plan_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_session_needs" ADD CONSTRAINT "plan_session_needs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "plan_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_session_needs" ADD CONSTRAINT "plan_session_needs_dutyId_fkey" FOREIGN KEY ("dutyId") REFERENCES "plan_duties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_session_days" ADD CONSTRAINT "plan_session_days_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "plan_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "plan_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_dutyId_fkey" FOREIGN KEY ("dutyId") REFERENCES "plan_duties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

