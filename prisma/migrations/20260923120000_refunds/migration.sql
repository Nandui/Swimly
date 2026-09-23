-- CreateTable
CREATE TABLE "RefundRequest" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "creatorId" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "clubName" TEXT NOT NULL,
    "customerName" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "memberNumber" TEXT NOT NULL DEFAULT '',
    "service" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL DEFAULT '',
    "requestedCents" INTEGER,
    "paymentDate" TEXT NOT NULL DEFAULT '',
    "paymentReference" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "handlerId" TEXT,
    "handlerName" TEXT,
    "approvedCents" INTEGER,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "paidOn" TEXT,
    "paidMethod" TEXT,
    "paidReference" TEXT,
    "paidById" TEXT,
    "paidByName" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundAttachment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "RefundAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundNotification" (
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

    CONSTRAINT "RefundNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefundRequest_number_key" ON "RefundRequest"("number");

-- CreateIndex
CREATE INDEX "RefundRequest_status_submittedAt_idx" ON "RefundRequest"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "RefundRequest_clubId_status_idx" ON "RefundRequest"("clubId", "status");

-- CreateIndex
CREATE INDEX "RefundRequest_creatorId_idx" ON "RefundRequest"("creatorId");

-- CreateIndex
CREATE INDEX "RefundRequest_handlerId_idx" ON "RefundRequest"("handlerId");

-- CreateIndex
CREATE INDEX "RefundRequest_paymentReference_idx" ON "RefundRequest"("paymentReference");

-- CreateIndex
CREATE INDEX "RefundEvent_requestId_createdAt_idx" ON "RefundEvent"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefundEvent_requestId_operationId_key" ON "RefundEvent"("requestId", "operationId");

-- CreateIndex
CREATE INDEX "RefundAttachment_requestId_idx" ON "RefundAttachment"("requestId");

-- CreateIndex
CREATE INDEX "RefundNotification_requestId_status_idx" ON "RefundNotification"("requestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RefundNotification_eventId_recipientId_key" ON "RefundNotification"("eventId", "recipientId");

-- AddForeignKey
ALTER TABLE "RefundEvent" ADD CONSTRAINT "RefundEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RefundRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundAttachment" ADD CONSTRAINT "RefundAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RefundRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundNotification" ADD CONSTRAINT "RefundNotification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RefundRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundNotification" ADD CONSTRAINT "RefundNotification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "RefundEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep financial invariants even if a future caller bypasses the workflow.
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_status_check" CHECK ("status" IN ('DRAFT','SUBMITTED','IN_REVIEW','NEEDS_INFORMATION','APPROVED','REFUNDED','DECLINED','WITHDRAWN'));
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_amount_check" CHECK (("requestedCents" IS NULL OR "requestedCents" > 0) AND ("approvedCents" IS NULL OR ("requestedCents" IS NOT NULL AND "approvedCents" > 0 AND "approvedCents" <= "requestedCents")));
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_paid_check" CHECK ("status" <> 'REFUNDED' OR ("approvedCents" IS NOT NULL AND "paidOn" IS NOT NULL AND "paidReference" IS NOT NULL AND "paidMethod" IS NOT NULL AND "paidById" IS NOT NULL));
