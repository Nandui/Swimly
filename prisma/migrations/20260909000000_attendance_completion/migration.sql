CREATE TABLE "AttendanceCompletion" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedById" TEXT,
    "completedByName" TEXT NOT NULL,
    CONSTRAINT "AttendanceCompletion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceCompletion_courseId_date_key" ON "AttendanceCompletion"("courseId", "date");
ALTER TABLE "AttendanceCompletion" ADD CONSTRAINT "AttendanceCompletion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
