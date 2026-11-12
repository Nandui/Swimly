-- Coinage requests (additive): change orders for the tills, from the desk to accounts.

-- CreateTable
CREATE TABLE IF NOT EXISTS "CoinageRequest" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "creatorId" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "clubName" TEXT NOT NULL,
    "forWhom" TEXT NOT NULL DEFAULT '',
    "neededBy" TEXT NOT NULL DEFAULT '',
    "lines" JSONB NOT NULL DEFAULT '{}',
    "totalCents" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "handlerId" TEXT,
    "handlerName" TEXT,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "orderedOn" TEXT,
    "deliveryOn" TEXT,
    "orderReference" TEXT,
    "orderedById" TEXT,
    "orderedByName" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinageRequest_pkey" PRIMARY KEY ("id"),
    -- Keep the order's invariants even if a future caller bypasses the workflow.
    CONSTRAINT "CoinageRequest_status_check" CHECK ("status" IN ('DRAFT','SUBMITTED','IN_REVIEW','NEEDS_INFORMATION','APPROVED','ORDERED','DECLINED','WITHDRAWN')),
    CONSTRAINT "CoinageRequest_total_check" CHECK ("totalCents" IS NULL OR "totalCents" > 0),
    CONSTRAINT "CoinageRequest_ordered_check" CHECK ("status" <> 'ORDERED' OR ("orderedOn" IS NOT NULL AND "deliveryOn" IS NOT NULL AND "orderReference" IS NOT NULL AND "orderedById" IS NOT NULL))
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CoinageEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinageEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoinageEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CoinageRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CoinageNotification" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "attemptedAt" TIMESTAMP(3),
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinageNotification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoinageNotification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CoinageRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CoinageNotification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CoinageEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoinageRequest_number_key" ON "CoinageRequest"("number");
CREATE INDEX IF NOT EXISTS "CoinageRequest_status_submittedAt_idx" ON "CoinageRequest"("status", "submittedAt");
CREATE INDEX IF NOT EXISTS "CoinageRequest_clubId_status_idx" ON "CoinageRequest"("clubId", "status");
CREATE INDEX IF NOT EXISTS "CoinageRequest_creatorId_idx" ON "CoinageRequest"("creatorId");
CREATE INDEX IF NOT EXISTS "CoinageRequest_handlerId_idx" ON "CoinageRequest"("handlerId");
CREATE INDEX IF NOT EXISTS "CoinageEvent_requestId_createdAt_idx" ON "CoinageEvent"("requestId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CoinageEvent_requestId_operationId_key" ON "CoinageEvent"("requestId", "operationId");
CREATE INDEX IF NOT EXISTS "CoinageNotification_requestId_status_idx" ON "CoinageNotification"("requestId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "CoinageNotification_eventId_recipientId_key" ON "CoinageNotification"("eventId", "recipientId");
