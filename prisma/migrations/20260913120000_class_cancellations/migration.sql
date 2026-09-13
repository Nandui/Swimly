-- Additive: recurring classes, enrolments and teaching records are untouched.
CREATE TABLE "ClassCancellation" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "className" TEXT NOT NULL,
  "levelName" TEXT NOT NULL,
  "programmeName" TEXT NOT NULL,
  "startMinutes" INTEGER NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "location" TEXT,
  "instructorName" TEXT,
  "reason" TEXT NOT NULL,
  "cancelledById" TEXT NOT NULL,
  "cancelledByName" TEXT NOT NULL,
  "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attendanceRecorded" INTEGER NOT NULL DEFAULT 0,
  "billingNotifiedAt" TIMESTAMP(3),
  "billingNotifiedById" TEXT,
  "billingNotifiedByName" TEXT,
  "billingNote" TEXT,
  CONSTRAINT "ClassCancellation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClassCancellation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "CancelledClassSwimmer" (
  "id" TEXT NOT NULL,
  "cancellationId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "swimmerName" TEXT NOT NULL,
  "memberNumber" TEXT,
  CONSTRAINT "CancelledClassSwimmer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CancelledClassSwimmer_cancellationId_fkey" FOREIGN KEY ("cancellationId") REFERENCES "ClassCancellation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CancelledClassSwimmer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ClassCancellation_courseId_date_key" ON "ClassCancellation"("courseId", "date");
CREATE INDEX "ClassCancellation_clubId_billingNotifiedAt_date_idx" ON "ClassCancellation"("clubId", "billingNotifiedAt", "date");
CREATE UNIQUE INDEX "CancelledClassSwimmer_cancellationId_studentId_key" ON "CancelledClassSwimmer"("cancellationId", "studentId");
CREATE INDEX "CancelledClassSwimmer_studentId_idx" ON "CancelledClassSwimmer"("studentId");
