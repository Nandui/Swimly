-- Staffing (docs/staffing.md): swim teacher rostering on the contract. Additive: eleven new
-- staffing_* tables with no relations to Core tables, and the 2026-27 exam seasons for each organisation.
-- CreateTable
CREATE TABLE "staffing_settings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "values" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_teachers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "college" TEXT NOT NULL DEFAULT 'none',
    "contract" TEXT NOT NULL DEFAULT 'swim_teacher',
    "wantsMore" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffing_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_slots" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'teaching',
    "name" TEXT NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "needed" INTEGER NOT NULL DEFAULT 1,
    "hardToFill" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffing_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_blocks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "publishedByName" TEXT,
    "shortAccepted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffing_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_shifts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "slotId" TEXT,
    "date" DATE NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "coversId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffing_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_acks" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "phonedAt" TIMESTAMP(3),
    "phonedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staffing_acks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_swaps" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "takerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "refusalReason" TEXT,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staffing_swaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_attendance" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "calledAt" TIMESTAMP(3),
    "method" TEXT,
    "reason" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "onTime" BOOLEAN,
    "minutesLate" INTEGER,
    "sentHome" BOOLEAN NOT NULL DEFAULT false,
    "loggedById" TEXT NOT NULL,
    "loggedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staffing_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_strikes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "cause" TEXT NOT NULL,
    "sourceId" TEXT,
    "occurredOn" DATE NOT NULL,
    "stage" TEXT NOT NULL,
    "counted" BOOLEAN NOT NULL DEFAULT true,
    "dueOn" DATE NOT NULL,
    "handledAt" TIMESTAMP(3),
    "handledById" TEXT,
    "handledByName" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "signedByBoth" BOOLEAN NOT NULL DEFAULT false,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staffing_strikes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_exam_seasons" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "college" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "firstYearStartsOn" DATE,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffing_exam_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_exam_absences" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "noticeSentOn" DATE,
    "outcome" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "strikeId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "decidedById" TEXT NOT NULL,
    "decidedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staffing_exam_absences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staffing_settings_orgId_key" ON "staffing_settings"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "staffing_teachers_userId_key" ON "staffing_teachers"("userId");

-- CreateIndex
CREATE INDEX "staffing_teachers_orgId_idx" ON "staffing_teachers"("orgId");

-- CreateIndex
CREATE INDEX "staffing_slots_siteId_weekday_idx" ON "staffing_slots"("siteId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "staffing_blocks_siteId_startsOn_key" ON "staffing_blocks"("siteId", "startsOn");

-- CreateIndex
CREATE INDEX "staffing_shifts_blockId_idx" ON "staffing_shifts"("blockId");

-- CreateIndex
CREATE INDEX "staffing_shifts_siteId_date_idx" ON "staffing_shifts"("siteId", "date");

-- CreateIndex
CREATE INDEX "staffing_shifts_userId_date_idx" ON "staffing_shifts"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "staffing_acks_blockId_userId_key" ON "staffing_acks"("blockId", "userId");

-- CreateIndex
CREATE INDEX "staffing_swaps_siteId_status_idx" ON "staffing_swaps"("siteId", "status");

-- CreateIndex
CREATE INDEX "staffing_swaps_requesterId_idx" ON "staffing_swaps"("requesterId");

-- CreateIndex
CREATE INDEX "staffing_attendance_siteId_createdAt_idx" ON "staffing_attendance"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "staffing_attendance_userId_idx" ON "staffing_attendance"("userId");

-- CreateIndex
CREATE INDEX "staffing_strikes_userId_semester_idx" ON "staffing_strikes"("userId", "semester");

-- CreateIndex
CREATE INDEX "staffing_strikes_siteId_handledAt_idx" ON "staffing_strikes"("siteId", "handledAt");

-- CreateIndex
CREATE INDEX "staffing_exam_seasons_orgId_startsOn_idx" ON "staffing_exam_seasons"("orgId", "startsOn");

-- CreateIndex
CREATE INDEX "staffing_exam_absences_userId_idx" ON "staffing_exam_absences"("userId");

-- CreateIndex
CREATE INDEX "staffing_exam_absences_siteId_createdAt_idx" ON "staffing_exam_absences"("siteId", "createdAt");

-- AddForeignKey
ALTER TABLE "staffing_shifts" ADD CONSTRAINT "staffing_shifts_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "staffing_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffing_acks" ADD CONSTRAINT "staffing_acks_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "staffing_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffing_swaps" ADD CONSTRAINT "staffing_swaps_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "staffing_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The 2026-27 exam seasons (spec, section 11). UCC's spring dates are not published yet.
INSERT INTO "staffing_exam_seasons" ("id", "orgId", "college", "name", "startsOn", "endsOn", "firstYearStartsOn", "confirmed", "createdAt", "updatedAt")
SELECT 'stfexam_' || o."id" || '_' || x.slug, o."id", x.college, x.name, x.starts::date, x.ends::date, x.first_year::date, x.confirmed, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organisation" o
CROSS JOIN (VALUES
  ('ucc_winter_2026', 'ucc', 'winter', '2026-12-07', '2026-12-18', '2026-12-14', false),
  ('mtu_winter_2026', 'mtu', 'winter', '2026-12-10', '2026-12-21', NULL, true),
  ('ucc_summer_2027', 'ucc', 'summer', '2027-04-30', '2027-05-14', NULL, false),
  ('mtu_summer_2027', 'mtu', 'summer', '2027-05-10', '2027-05-20', NULL, true)
) AS x(slug, college, name, starts, ends, first_year, confirmed);
