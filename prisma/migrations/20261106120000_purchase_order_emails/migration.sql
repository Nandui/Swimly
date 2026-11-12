-- Purchasing (docs/purchasing.md): emailing an approved order to its supplier. Additive only:
-- a record of every email sent (to the supplier, or a test to the sender) and a per-organisation
-- switch that keeps emails to suppliers off until someone turns them on.

-- CreateTable
CREATE TABLE "PurchaseOrderEmail" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "sentById" TEXT NOT NULL,
    "sentByName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasingSettings" (
    "orgId" TEXT NOT NULL,
    "supplierEmailsOn" BOOLEAN NOT NULL DEFAULT false,
    "changedById" TEXT,
    "changedByName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchasingSettings_pkey" PRIMARY KEY ("orgId")
);

-- CreateIndex
CREATE INDEX "PurchaseOrderEmail_orderId_createdAt_idx" ON "PurchaseOrderEmail"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "PurchaseOrderEmail" ADD CONSTRAINT "PurchaseOrderEmail_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
