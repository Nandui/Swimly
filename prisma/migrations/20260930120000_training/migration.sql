-- Training (phase 6): a course catalogue and each person's assignments.
-- Additive only: two new tables, nothing existing changes.

CREATE TABLE "TrainingCourse" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "requiresSignoff" BOOLEAN NOT NULL DEFAULT false,
    "grantsTypeId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCourse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingAssignment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "dueOn" DATE,
    "assignedById" TEXT,
    "assignedByName" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "learnerNote" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "signedOffById" TEXT,
    "signedOffByName" TEXT,
    "signoffNote" TEXT NOT NULL DEFAULT '',
    "qualificationId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingCourse_orgId_title_key" ON "TrainingCourse"("orgId", "title");
CREATE INDEX "TrainingAssignment_userId_status_idx" ON "TrainingAssignment"("userId", "status");
CREATE INDEX "TrainingAssignment_orgId_status_idx" ON "TrainingAssignment"("orgId", "status");
CREATE INDEX "TrainingAssignment_courseId_idx" ON "TrainingAssignment"("courseId");
-- One open assignment per person and course.
CREATE UNIQUE INDEX "TrainingAssignment_open_key" ON "TrainingAssignment"("courseId", "userId") WHERE "status" IN ('ASSIGNED', 'SUBMITTED');

ALTER TABLE "TrainingCourse" ADD CONSTRAINT "TrainingCourse_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingCourse" ADD CONSTRAINT "TrainingCourse_grantsTypeId_fkey" FOREIGN KEY ("grantsTypeId") REFERENCES "QualificationType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_status_check" CHECK ("status" IN ('ASSIGNED','SUBMITTED','COMPLETED','CANCELLED'));
-- A completed assignment says when; a cancelled one says why.
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_completed_check" CHECK ("status" <> 'COMPLETED' OR "completedAt" IS NOT NULL);
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_cancelled_check" CHECK ("status" <> 'CANCELLED' OR "cancelledAt" IS NOT NULL);
