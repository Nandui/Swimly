-- AlterTable
ALTER TABLE "incidents_reports" ADD COLUMN     "hsaFatal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rootCause" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "whys" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "incidents_statements" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "givenBy" TEXT NOT NULL,
    "givenAs" TEXT NOT NULL DEFAULT '',
    "takenOn" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents_actions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "dueOn" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "note" TEXT NOT NULL DEFAULT '',
    "doneById" TEXT,
    "doneByName" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedEmailAt" TIMESTAMP(3),
    "dueEmailAt" TIMESTAMP(3),
    "overdueEmailAt" TIMESTAMP(3),
    "emailError" TEXT,

    CONSTRAINT "incidents_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents_files" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "addedById" TEXT NOT NULL,
    "addedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removedById" TEXT,

    CONSTRAINT "incidents_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incidents_statements_reportId_idx" ON "incidents_statements"("reportId");

-- CreateIndex
CREATE INDEX "incidents_actions_reportId_idx" ON "incidents_actions"("reportId");

-- CreateIndex
CREATE INDEX "incidents_actions_status_dueOn_idx" ON "incidents_actions"("status", "dueOn");

-- CreateIndex
CREATE INDEX "incidents_actions_ownerId_status_idx" ON "incidents_actions"("ownerId", "status");

-- CreateIndex
CREATE INDEX "incidents_files_reportId_idx" ON "incidents_files"("reportId");

-- AddForeignKey
ALTER TABLE "incidents_statements" ADD CONSTRAINT "incidents_statements_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "incidents_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents_actions" ADD CONSTRAINT "incidents_actions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "incidents_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents_files" ADD CONSTRAINT "incidents_files_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "incidents_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

