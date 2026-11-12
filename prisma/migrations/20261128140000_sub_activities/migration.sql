-- Sub-activities: what is done while on an activity, and who does which that day (owner, 20 October 2026). Additive: two new tables.
-- CreateTable
CREATE TABLE "SubActivity" (
    "id" TEXT NOT NULL,
    "activityTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "when" TEXT NOT NULL DEFAULT 'during',
    "atMinutes" INTEGER,
    "usual" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotaAssignmentSub" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "subActivityId" TEXT,
    "name" TEXT NOT NULL,
    "when" TEXT NOT NULL,
    "atMinutes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RotaAssignmentSub_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubActivity_activityTypeId_idx" ON "SubActivity"("activityTypeId");

-- CreateIndex
CREATE INDEX "RotaAssignmentSub_assignmentId_idx" ON "RotaAssignmentSub"("assignmentId");

-- AddForeignKey
ALTER TABLE "SubActivity" ADD CONSTRAINT "SubActivity_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "RotaActivityType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaAssignmentSub" ADD CONSTRAINT "RotaAssignmentSub_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "RotaAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaAssignmentSub" ADD CONSTRAINT "RotaAssignmentSub_subActivityId_fkey" FOREIGN KEY ("subActivityId") REFERENCES "SubActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

