-- CreateTable
CREATE TABLE "incidents_reports" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "orgId" TEXT,
    "siteId" TEXT NOT NULL,
    "area" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "occurredAt" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "immediateAction" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'reported',
    "serious" BOOLEAN NOT NULL DEFAULT false,
    "reporterId" TEXT NOT NULL,
    "reporterName" TEXT NOT NULL,
    "severityActual" INTEGER,
    "severityPotential" INTEGER,
    "hsaReportable" BOOLEAN,
    "hsaDueOn" TEXT,
    "hsaReference" TEXT NOT NULL DEFAULT '',
    "parentInformed" TEXT NOT NULL DEFAULT '',
    "triageNote" TEXT NOT NULL DEFAULT '',
    "triagedById" TEXT,
    "triagedByName" TEXT,
    "triagedAt" TIMESTAMP(3),
    "closeNote" TEXT NOT NULL DEFAULT '',
    "closedById" TEXT,
    "closedByName" TEXT,
    "closedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents_people" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "injured" BOOLEAN NOT NULL DEFAULT false,
    "bodyPart" TEXT NOT NULL DEFAULT '',
    "injury" TEXT NOT NULL DEFAULT '',
    "firstAid" TEXT NOT NULL DEFAULT '',
    "firstAidBy" TEXT NOT NULL DEFAULT '',
    "ambulance" BOOLEAN NOT NULL DEFAULT false,
    "hospital" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents_witnesses" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_witnesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents_events" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents_access_events" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_access_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents_notifications" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "incidents_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "incidents_reports_number_key" ON "incidents_reports"("number");

-- CreateIndex
CREATE INDEX "incidents_reports_siteId_status_idx" ON "incidents_reports"("siteId", "status");

-- CreateIndex
CREATE INDEX "incidents_reports_reporterId_idx" ON "incidents_reports"("reporterId");

-- CreateIndex
CREATE INDEX "incidents_people_reportId_idx" ON "incidents_people"("reportId");

-- CreateIndex
CREATE INDEX "incidents_witnesses_reportId_idx" ON "incidents_witnesses"("reportId");

-- CreateIndex
CREATE INDEX "incidents_events_reportId_createdAt_idx" ON "incidents_events"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "incidents_access_events_reportId_createdAt_idx" ON "incidents_access_events"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "incidents_notifications_reportId_idx" ON "incidents_notifications"("reportId");

-- AddForeignKey
ALTER TABLE "incidents_people" ADD CONSTRAINT "incidents_people_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "incidents_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents_witnesses" ADD CONSTRAINT "incidents_witnesses_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "incidents_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents_events" ADD CONSTRAINT "incidents_events_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "incidents_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents_access_events" ADD CONSTRAINT "incidents_access_events_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "incidents_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents_notifications" ADD CONSTRAINT "incidents_notifications_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "incidents_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

