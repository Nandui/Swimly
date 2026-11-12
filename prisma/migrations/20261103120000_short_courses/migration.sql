-- CreateTable
CREATE TABLE "short_courses_types" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "weeks" INTEGER NOT NULL DEFAULT 6,
    "sessionMinutes" INTEGER NOT NULL DEFAULT 60,
    "minAge" INTEGER,
    "healthForm" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "short_courses_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "short_courses_courses" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "capacity" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "instructorId" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "short_courses_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "short_courses_sessions" (
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

    CONSTRAINT "short_courses_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "short_courses_participants" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "dateOfBirth" DATE,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "payment" TEXT NOT NULL DEFAULT 'owed',
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "healthFormOn" DATE,
    "note" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'staff',
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "short_courses_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "short_courses_attendance" (
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL,

    CONSTRAINT "short_courses_attendance_pkey" PRIMARY KEY ("sessionId","participantId")
);

-- CreateIndex
CREATE UNIQUE INDEX "short_courses_types_orgId_name_key" ON "short_courses_types"("orgId", "name");

-- CreateIndex
CREATE INDEX "short_courses_courses_siteId_status_idx" ON "short_courses_courses"("siteId", "status");

-- CreateIndex
CREATE INDEX "short_courses_courses_instructorId_idx" ON "short_courses_courses"("instructorId");

-- CreateIndex
CREATE INDEX "short_courses_sessions_courseId_date_idx" ON "short_courses_sessions"("courseId", "date");

-- CreateIndex
CREATE INDEX "short_courses_sessions_date_idx" ON "short_courses_sessions"("date");

-- CreateIndex
CREATE INDEX "short_courses_participants_courseId_status_idx" ON "short_courses_participants"("courseId", "status");

-- AddForeignKey
ALTER TABLE "short_courses_courses" ADD CONSTRAINT "short_courses_courses_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "short_courses_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_courses_sessions" ADD CONSTRAINT "short_courses_sessions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "short_courses_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_courses_participants" ADD CONSTRAINT "short_courses_participants_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "short_courses_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_courses_attendance" ADD CONSTRAINT "short_courses_attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "short_courses_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_courses_attendance" ADD CONSTRAINT "short_courses_attendance_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "short_courses_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

