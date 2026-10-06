-- Rota rebuilt around activities (owner decisions, 6 October 2026): the organisation's activity list, each day's needs and who is on each place, shared weeks, the log of changes to live days, repeating bookings, and the swim school's planned teacher for a class on a date. Additive only: the retired rota tables stay until development has its own database.

-- CreateTable
CREATE TABLE "ClassPlannedTeacher" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "teacherId" TEXT,
    "teacherName" TEXT,
    "setById" TEXT,
    "setByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassPlannedTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotaActivityType" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'activity',
    "requiredTypeId" TEXT,
    "fromClasses" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotaActivityType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotaNeed" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "typeId" TEXT NOT NULL,
    "place" TEXT NOT NULL DEFAULT '',
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "places" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT NOT NULL DEFAULT '',
    "repeatId" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotaNeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotaAssignment" (
    "id" TEXT NOT NULL,
    "needId" TEXT NOT NULL,
    "place" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotaAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotaWeekShare" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "monday" DATE NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sharedById" TEXT,
    "sharedByName" TEXT NOT NULL,

    CONSTRAINT "RotaWeekShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotaLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "userId" TEXT,
    "reason" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "absenceId" TEXT,
    "byId" TEXT,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timepointAt" TIMESTAMP(3),
    "timepointById" TEXT,
    "timepointByName" TEXT,

    CONSTRAINT "RotaLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotaRepeat" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "place" TEXT NOT NULL DEFAULT '',
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "places" INTEGER NOT NULL DEFAULT 1,
    "weekdays" INTEGER[],
    "firstDay" DATE NOT NULL,
    "lastDay" DATE NOT NULL,
    "skipDates" DATE[],
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "RotaRepeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassPlannedTeacher_teacherId_date_idx" ON "ClassPlannedTeacher"("teacherId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ClassPlannedTeacher_courseId_date_key" ON "ClassPlannedTeacher"("courseId", "date");

-- CreateIndex
CREATE INDEX "RotaActivityType_departmentId_idx" ON "RotaActivityType"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "RotaActivityType_orgId_name_key" ON "RotaActivityType"("orgId", "name");

-- CreateIndex
CREATE INDEX "RotaNeed_siteId_date_idx" ON "RotaNeed"("siteId", "date");

-- CreateIndex
CREATE INDEX "RotaNeed_repeatId_idx" ON "RotaNeed"("repeatId");

-- CreateIndex
CREATE INDEX "RotaAssignment_needId_idx" ON "RotaAssignment"("needId");

-- CreateIndex
CREATE INDEX "RotaAssignment_userId_idx" ON "RotaAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RotaWeekShare_siteId_departmentId_monday_key" ON "RotaWeekShare"("siteId", "departmentId", "monday");

-- CreateIndex
CREATE INDEX "RotaLog_siteId_date_idx" ON "RotaLog"("siteId", "date");

-- CreateIndex
CREATE INDEX "RotaLog_userId_idx" ON "RotaLog"("userId");

-- CreateIndex
CREATE INDEX "RotaRepeat_siteId_idx" ON "RotaRepeat"("siteId");

-- AddForeignKey
ALTER TABLE "ClassPlannedTeacher" ADD CONSTRAINT "ClassPlannedTeacher_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPlannedTeacher" ADD CONSTRAINT "ClassPlannedTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaActivityType" ADD CONSTRAINT "RotaActivityType_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaActivityType" ADD CONSTRAINT "RotaActivityType_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaActivityType" ADD CONSTRAINT "RotaActivityType_requiredTypeId_fkey" FOREIGN KEY ("requiredTypeId") REFERENCES "QualificationType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaNeed" ADD CONSTRAINT "RotaNeed_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaNeed" ADD CONSTRAINT "RotaNeed_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "RotaActivityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaNeed" ADD CONSTRAINT "RotaNeed_repeatId_fkey" FOREIGN KEY ("repeatId") REFERENCES "RotaRepeat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaAssignment" ADD CONSTRAINT "RotaAssignment_needId_fkey" FOREIGN KEY ("needId") REFERENCES "RotaNeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaAssignment" ADD CONSTRAINT "RotaAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaWeekShare" ADD CONSTRAINT "RotaWeekShare_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaWeekShare" ADD CONSTRAINT "RotaWeekShare_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaLog" ADD CONSTRAINT "RotaLog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaRepeat" ADD CONSTRAINT "RotaRepeat_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaRepeat" ADD CONSTRAINT "RotaRepeat_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "RotaActivityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

