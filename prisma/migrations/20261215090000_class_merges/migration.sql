-- Additive: a dated merge of one class into another at the same level. Weekly classes,
-- enrolments and attendance are untouched.
CREATE TABLE "ClassMerge" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "fromCourseId" TEXT NOT NULL,
  "intoCourseId" TEXT NOT NULL,
  "levelName" TEXT NOT NULL,
  "programmeName" TEXT NOT NULL,
  "fromClassName" TEXT NOT NULL,
  "fromStartMinutes" INTEGER NOT NULL,
  "intoClassName" TEXT NOT NULL,
  "intoStartMinutes" INTEGER NOT NULL,
  "intoLocation" TEXT,
  "instructorName" TEXT,
  "reason" TEXT NOT NULL,
  "mergedById" TEXT NOT NULL,
  "mergedByName" TEXT NOT NULL,
  "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassMerge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClassMerge_fromCourseId_fkey" FOREIGN KEY ("fromCourseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassMerge_intoCourseId_fkey" FOREIGN KEY ("intoCourseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "ClassMergeSwimmer" (
  "id" TEXT NOT NULL,
  "mergeId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "swimmerName" TEXT NOT NULL,
  "memberNumber" TEXT,
  CONSTRAINT "ClassMergeSwimmer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClassMergeSwimmer_mergeId_fkey" FOREIGN KEY ("mergeId") REFERENCES "ClassMerge"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClassMergeSwimmer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ClassMerge_fromCourseId_date_key" ON "ClassMerge"("fromCourseId", "date");
CREATE INDEX "ClassMerge_intoCourseId_date_idx" ON "ClassMerge"("intoCourseId", "date");
CREATE INDEX "ClassMerge_clubId_date_idx" ON "ClassMerge"("clubId", "date");
CREATE UNIQUE INDEX "ClassMergeSwimmer_mergeId_studentId_key" ON "ClassMergeSwimmer"("mergeId", "studentId");
CREATE INDEX "ClassMergeSwimmer_studentId_idx" ON "ClassMergeSwimmer"("studentId");
