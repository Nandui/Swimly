-- Purchasing: approved suppliers and products, approval rules per role and limit, purchase orders numbered per site (PO-BT-00001). Sites get a short code. Additive only.


-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "code" TEXT;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseProduct" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT '',
    "priceCents" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseApprovalRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "supplierId" TEXT,
    "roleId" TEXT NOT NULL,
    "limitCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "neededBy" DATE,
    "note" TEXT NOT NULL DEFAULT '',
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT NOT NULL DEFAULT '',
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT '',
    "unitPriceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderCounter" (
    "siteId" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderCounter_pkey" PRIMARY KEY ("siteId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_orgId_name_key" ON "Supplier"("orgId", "name");

-- CreateIndex
CREATE INDEX "PurchaseProduct_supplierId_idx" ON "PurchaseProduct"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseApprovalRule_orgId_supplierId_idx" ON "PurchaseApprovalRule"("orgId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_number_key" ON "PurchaseOrder"("number");

-- CreateIndex
CREATE INDEX "PurchaseOrder_orgId_status_idx" ON "PurchaseOrder"("orgId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_siteId_createdAt_idx" ON "PurchaseOrder"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_orderId_idx" ON "PurchaseOrderLine"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Club_code_key" ON "Club"("code");

-- AddForeignKey
ALTER TABLE "PurchaseProduct" ADD CONSTRAINT "PurchaseProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseApprovalRule" ADD CONSTRAINT "PurchaseApprovalRule_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseApprovalRule" ADD CONSTRAINT "PurchaseApprovalRule_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "StaffRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PurchaseProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderCounter" ADD CONSTRAINT "PurchaseOrderCounter_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Guards the rules the app keeps.
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_status_check" CHECK ("status" IN ('draft', 'pending', 'approved', 'rejected', 'cancelled'));
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_quantity_check" CHECK ("quantity" > 0 AND "unitPriceCents" >= 0);
ALTER TABLE "PurchaseProduct" ADD CONSTRAINT "PurchaseProduct_price_check" CHECK ("priceCents" >= 0);
ALTER TABLE "PurchaseApprovalRule" ADD CONSTRAINT "PurchaseApprovalRule_limit_check" CHECK ("limitCents" IS NULL OR "limitCents" >= 0);
ALTER TABLE "Club" ADD CONSTRAINT "Club_code_check" CHECK ("code" IS NULL OR "code" ~ '^[A-Z]{2,4}$');

-- The sites' short codes as the payroll and finance systems use them; any other site gets one in Admin, Clubs.
UPDATE "Club" SET "code" = 'BT' WHERE "id" = (SELECT "id" FROM "Club" WHERE "code" IS NULL AND "archivedAt" IS NULL AND "name" ILIKE '%Bishopstown%' ORDER BY "sortOrder", "name" LIMIT 1) AND NOT EXISTS (SELECT 1 FROM "Club" WHERE "code" = 'BT');
UPDATE "Club" SET "code" = 'CF' WHERE "id" = (SELECT "id" FROM "Club" WHERE "code" IS NULL AND "archivedAt" IS NULL AND "name" ILIKE '%Churchfield%' ORDER BY "sortOrder", "name" LIMIT 1) AND NOT EXISTS (SELECT 1 FROM "Club" WHERE "code" = 'CF');
UPDATE "Club" SET "code" = 'DO' WHERE "id" = (SELECT "id" FROM "Club" WHERE "code" IS NULL AND "archivedAt" IS NULL AND "name" ILIKE '%Douglas%' ORDER BY "sortOrder", "name" LIMIT 1) AND NOT EXISTS (SELECT 1 FROM "Club" WHERE "code" = 'DO');
