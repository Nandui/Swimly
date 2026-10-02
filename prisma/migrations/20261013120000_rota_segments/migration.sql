-- Rota: what someone does during their shift (activities and breaks), and a note per site per day. Additive only.

CREATE TABLE "RotaShiftSegment" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RotaShiftSegment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RotaShiftSegment_kind_check" CHECK ("kind" IN ('activity', 'break')),
    CONSTRAINT "RotaShiftSegment_times_check" CHECK ("endMinutes" > "startMinutes")
);

CREATE INDEX "RotaShiftSegment_shiftId_idx" ON "RotaShiftSegment"("shiftId");
ALTER TABLE "RotaShiftSegment" ADD CONSTRAINT "RotaShiftSegment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "RotaShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RotaDayNote" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "byId" TEXT,
    "byName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotaDayNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RotaDayNote_siteId_date_key" ON "RotaDayNote"("siteId", "date");
ALTER TABLE "RotaDayNote" ADD CONSTRAINT "RotaDayNote_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
