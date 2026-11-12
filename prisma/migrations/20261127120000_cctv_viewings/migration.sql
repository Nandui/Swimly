-- The CCTV log (owner request, 20 October 2026; docs/cctv.md). Additive: two new tables.
CREATE TABLE "cctv_viewings" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "orgId" TEXT,
    "siteId" TEXT NOT NULL,
    "viewedOn" TEXT NOT NULL,
    "viewedAt" TEXT NOT NULL,
    "checkedBy" TEXT NOT NULL,
    "othersPresent" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "cameras" TEXT NOT NULL,
    "footageOn" TEXT NOT NULL,
    "footageFrom" TEXT NOT NULL,
    "footageTo" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "copies" TEXT NOT NULL DEFAULT '',
    "incidentNumber" INTEGER,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cctv_viewings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cctv_viewings_number_key" ON "cctv_viewings"("number");
CREATE INDEX "cctv_viewings_siteId_viewedOn_idx" ON "cctv_viewings"("siteId", "viewedOn");
CREATE INDEX "cctv_viewings_recordedById_idx" ON "cctv_viewings"("recordedById");

CREATE TABLE "cctv_viewing_notes" (
    "id" TEXT NOT NULL,
    "viewingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "byId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cctv_viewing_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cctv_viewing_notes_viewingId_idx" ON "cctv_viewing_notes"("viewingId");
ALTER TABLE "cctv_viewing_notes" ADD CONSTRAINT "cctv_viewing_notes_viewingId_fkey" FOREIGN KEY ("viewingId") REFERENCES "cctv_viewings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
