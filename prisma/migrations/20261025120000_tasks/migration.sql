-- Tasks (owner request, 8 October 2026; docs/tasks.md). Additive only.
-- CreateTable
CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "siteIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" BOOLEAN NOT NULL DEFAULT false,
    "checklist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fields" JSONB NOT NULL DEFAULT '[]',
    "minimumRecords" INTEGER NOT NULL DEFAULT 1,
    "schedules" JSONB NOT NULL DEFAULT '[]',
    "requiresComment" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "scheduleKey" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "definition" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "checks" BOOLEAN[] DEFAULT ARRAY[]::BOOLEAN[],
    "records" JSONB NOT NULL DEFAULT '[{}]',
    "exceptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reason" TEXT NOT NULL DEFAULT '',
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "completedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "addedByName" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "byId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskFile" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "byId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "dueOn" DATE,
    "status" TEXT NOT NULL DEFAULT 'open',
    "raisedById" TEXT NOT NULL,
    "raisedByName" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByName" TEXT,
    "resolution" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskTemplate_orgId_status_idx" ON "TaskTemplate"("orgId", "status");

-- CreateIndex
CREATE INDEX "Task_siteId_date_idx" ON "Task"("siteId", "date");

-- CreateIndex
CREATE INDEX "Task_orgId_date_idx" ON "Task"("orgId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Task_templateId_siteId_date_scheduleKey_key" ON "Task"("templateId", "siteId", "date", "scheduleKey");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_idx" ON "TaskComment"("taskId");

-- CreateIndex
CREATE INDEX "TaskFile_taskId_idx" ON "TaskFile"("taskId");

-- CreateIndex
CREATE INDEX "TaskAction_siteId_status_idx" ON "TaskAction"("siteId", "status");

-- CreateIndex
CREATE INDEX "TaskAction_taskId_idx" ON "TaskAction"("taskId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TaskTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskFile" ADD CONSTRAINT "TaskFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAction" ADD CONSTRAINT "TaskAction_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAction" ADD CONSTRAINT "TaskAction_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

