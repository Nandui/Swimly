-- CCTV footage requests on incident reports (owner request, 19 October 2026). Additive: two new tables.
CREATE TABLE "incidents_footage_requests" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "details" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "emailedAt" TIMESTAMP(3),
    "emailError" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incidents_footage_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "incidents_footage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "pathname" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "uploadedBy" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "removedById" TEXT,
    CONSTRAINT "incidents_footage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "incidents_footage_requests_tokenHash_key" ON "incidents_footage_requests"("tokenHash");
CREATE INDEX "incidents_footage_requests_reportId_idx" ON "incidents_footage_requests"("reportId");
CREATE UNIQUE INDEX "incidents_footage_pathname_key" ON "incidents_footage"("pathname");
CREATE INDEX "incidents_footage_requestId_idx" ON "incidents_footage"("requestId");
CREATE INDEX "incidents_footage_reportId_idx" ON "incidents_footage"("reportId");

ALTER TABLE "incidents_footage_requests" ADD CONSTRAINT "incidents_footage_requests_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "incidents_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incidents_footage" ADD CONSTRAINT "incidents_footage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "incidents_footage_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incidents_footage" ADD CONSTRAINT "incidents_footage_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "incidents_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
