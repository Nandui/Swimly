-- Bookings at a site that need staff (docs/rota.md). Additive: two new tables
-- and two nullable columns on RotaShift.
CREATE TABLE "RotaBooking" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "departmentId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "place" TEXT NOT NULL DEFAULT '',
    "weekdays" INTEGER[],
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "firstDay" DATE NOT NULL,
    "lastDay" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RotaBooking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RotaBooking_kind_check" CHECK ("kind" IN ('school', 'party', 'lanes', 'event', 'other')),
    CONSTRAINT "RotaBooking_days_check" CHECK ("lastDay" >= "firstDay"),
    CONSTRAINT "RotaBooking_times_check" CHECK ("startMinutes" >= 0 AND "endMinutes" <= 1440 AND "endMinutes" > "startMinutes")
);
CREATE INDEX "RotaBooking_siteId_lastDay_idx" ON "RotaBooking"("siteId", "lastDay");
ALTER TABLE "RotaBooking" ADD CONSTRAINT "RotaBooking_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RotaBooking" ADD CONSTRAINT "RotaBooking_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RotaBookingNeed" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "requiredTypeId" TEXT,
    CONSTRAINT "RotaBookingNeed_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RotaBookingNeed_count_check" CHECK ("count" BETWEEN 1 AND 20)
);
CREATE INDEX "RotaBookingNeed_bookingId_idx" ON "RotaBookingNeed"("bookingId");
ALTER TABLE "RotaBookingNeed" ADD CONSTRAINT "RotaBookingNeed_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RotaBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RotaBookingNeed" ADD CONSTRAINT "RotaBookingNeed_requiredTypeId_fkey" FOREIGN KEY ("requiredTypeId") REFERENCES "QualificationType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RotaShift" ADD COLUMN "bookingId" TEXT;
ALTER TABLE "RotaShift" ADD COLUMN "bookingNeedId" TEXT;
ALTER TABLE "RotaShift" ADD CONSTRAINT "RotaShift_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RotaBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RotaShift" ADD CONSTRAINT "RotaShift_bookingNeedId_fkey" FOREIGN KEY ("bookingNeedId") REFERENCES "RotaBookingNeed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "RotaShift_bookingId_idx" ON "RotaShift"("bookingId");
