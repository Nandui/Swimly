-- CreateTable
CREATE TABLE "AcademyCourseType" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "awardingBody" TEXT NOT NULL DEFAULT '',
    "minAge" INTEGER,
    "minHours" INTEGER NOT NULL DEFAULT 0,
    "checks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "qualificationTypeId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademyCourseType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademyCourse" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "capacity" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "tutorId" TEXT NOT NULL,
    "assessorId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "AcademyCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademySession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "place" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "registerAt" TIMESTAMP(3),
    "registerById" TEXT,
    "registerBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademyCandidate" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "dateOfBirth" DATE,
    "payment" TEXT NOT NULL DEFAULT 'owed',
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "swimTestOn" DATE,
    "medicalOn" DATE,
    "idCheckedOn" DATE,
    "checkedByName" TEXT,
    "resultOn" DATE,
    "resultNote" TEXT NOT NULL DEFAULT '',
    "certificateNumber" TEXT NOT NULL DEFAULT '',
    "certificateExpires" DATE,
    "qualificationId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademyCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademyAttendance" (
    "sessionId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,

    CONSTRAINT "AcademyAttendance_pkey" PRIMARY KEY ("sessionId","candidateId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademyCourseType_orgId_name_key" ON "AcademyCourseType"("orgId", "name");

-- CreateIndex
CREATE INDEX "AcademyCourse_siteId_status_idx" ON "AcademyCourse"("siteId", "status");

-- CreateIndex
CREATE INDEX "AcademyCourse_tutorId_idx" ON "AcademyCourse"("tutorId");

-- CreateIndex
CREATE INDEX "AcademySession_courseId_date_idx" ON "AcademySession"("courseId", "date");

-- CreateIndex
CREATE INDEX "AcademySession_date_idx" ON "AcademySession"("date");

-- CreateIndex
CREATE INDEX "AcademyCandidate_courseId_idx" ON "AcademyCandidate"("courseId");

-- CreateIndex
CREATE INDEX "AcademyCandidate_userId_idx" ON "AcademyCandidate"("userId");

-- AddForeignKey
ALTER TABLE "AcademyCourseType" ADD CONSTRAINT "AcademyCourseType_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyCourseType" ADD CONSTRAINT "AcademyCourseType_qualificationTypeId_fkey" FOREIGN KEY ("qualificationTypeId") REFERENCES "QualificationType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyCourse" ADD CONSTRAINT "AcademyCourse_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyCourse" ADD CONSTRAINT "AcademyCourse_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AcademyCourseType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyCourse" ADD CONSTRAINT "AcademyCourse_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyCourse" ADD CONSTRAINT "AcademyCourse_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademySession" ADD CONSTRAINT "AcademySession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "AcademyCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyCandidate" ADD CONSTRAINT "AcademyCandidate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "AcademyCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyCandidate" ADD CONSTRAINT "AcademyCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyAttendance" ADD CONSTRAINT "AcademyAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyAttendance" ADD CONSTRAINT "AcademyAttendance_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "AcademyCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Values the app writes from its metadata maps, and sane numbers.
ALTER TABLE "AcademyCourseType" ADD CONSTRAINT "AcademyCourseType_kind_check" CHECK ("kind" IN ('lifeguard', 'swim-teacher', 'other'));
ALTER TABLE "AcademyCourseType" ADD CONSTRAINT "AcademyCourseType_numbers_check" CHECK (("minAge" IS NULL OR "minAge" BETWEEN 8 AND 99) AND "minHours" BETWEEN 0 AND 500 AND char_length("name") BETWEEN 2 AND 80);
ALTER TABLE "AcademyCourse" ADD CONSTRAINT "AcademyCourse_status_check" CHECK ("status" IN ('planned', 'running', 'completed', 'cancelled'));
ALTER TABLE "AcademyCourse" ADD CONSTRAINT "AcademyCourse_numbers_check" CHECK ("capacity" BETWEEN 1 AND 100 AND "priceCents" >= 0);
ALTER TABLE "AcademySession" ADD CONSTRAINT "AcademySession_times_check" CHECK ("startMinutes" >= 0 AND "endMinutes" <= 1440 AND "endMinutes" > "startMinutes");
ALTER TABLE "AcademyCandidate" ADD CONSTRAINT "AcademyCandidate_payment_check" CHECK ("payment" IN ('paid', 'deposit', 'owed', 'waived') AND "paidCents" >= 0);
ALTER TABLE "AcademyCandidate" ADD CONSTRAINT "AcademyCandidate_status_check" CHECK ("status" IN ('booked', 'withdrawn', 'passed', 'referred', 'failed'));
ALTER TABLE "AcademyAttendance" ADD CONSTRAINT "AcademyAttendance_minutes_check" CHECK ("minutes" BETWEEN 0 AND 1440);
