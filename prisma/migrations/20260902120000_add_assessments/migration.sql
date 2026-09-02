-- Assessment sessions and bookings. A session is a dated one-off with places;
-- a booking is a child on it, and the level they were placed at afterwards.

-- CreateEnum
CREATE TYPE "AssessmentBookingStatus" AS ENUM ('BOOKED', 'ATTENDED', 'NO_SHOW', 'CANCELLED');

-- CreateTable
CREATE TABLE "AssessmentSession" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "location" TEXT,
    "capacity" INTEGER,
    "instructorId" TEXT,
    "programmeId" TEXT NOT NULL,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentBooking" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AssessmentBookingStatus" NOT NULL DEFAULT 'BOOKED',
    "bookedById" TEXT,
    "bookedByName" TEXT NOT NULL,
    "outcomeLevelId" TEXT,
    "outcomeNote" TEXT,
    "assessedById" TEXT,
    "assessedByName" TEXT,
    "assessedOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentSession_date_startMinutes_idx" ON "AssessmentSession"("date", "startMinutes");

-- CreateIndex
CREATE INDEX "AssessmentSession_programmeId_date_idx" ON "AssessmentSession"("programmeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentBooking_sessionId_studentId_key" ON "AssessmentBooking"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "AssessmentBooking_studentId_status_idx" ON "AssessmentBooking"("studentId", "status");

-- CreateIndex
CREATE INDEX "AssessmentBooking_outcomeLevelId_idx" ON "AssessmentBooking"("outcomeLevelId");

-- AddForeignKey
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentBooking" ADD CONSTRAINT "AssessmentBooking_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentBooking" ADD CONSTRAINT "AssessmentBooking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentBooking" ADD CONSTRAINT "AssessmentBooking_outcomeLevelId_fkey" FOREIGN KEY ("outcomeLevelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentBooking" ADD CONSTRAINT "AssessmentBooking_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentBooking" ADD CONSTRAINT "AssessmentBooking_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
