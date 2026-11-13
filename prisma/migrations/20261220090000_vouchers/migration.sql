-- Vouchers (owner, 12 November 2026, D30): batches of vouchers given to communities and
-- organisations (a family swim at Christmas, for example), each voucher with its own code, used
-- once at reception.
-- Additive: two new tables.

-- CreateTable
CREATE TABLE "voucher_batches" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "occasion" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "contactName" TEXT NOT NULL DEFAULT '',
    "contactDetail" TEXT NOT NULL DEFAULT '',
    "service" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "validFrom" DATE NOT NULL,
    "validUntil" DATE NOT NULL,
    "siteIds" TEXT[],
    "terms" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedByName" TEXT,
    "voidReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voucher_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "redeemedSiteId" TEXT,
    "redeemedById" TEXT,
    "redeemedByName" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByName" TEXT,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voucher_batches_orgId_createdAt_idx" ON "voucher_batches"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_batchId_number_key" ON "vouchers"("batchId", "number");

-- CreateIndex
CREATE INDEX "vouchers_orgId_redeemedSiteId_redeemedAt_idx" ON "vouchers"("orgId", "redeemedSiteId", "redeemedAt");

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "voucher_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Guards the rules the app keeps.
ALTER TABLE "voucher_batches" ADD CONSTRAINT "voucher_batches_quantity_check" CHECK ("quantity" BETWEEN 1 AND 500);
ALTER TABLE "voucher_batches" ADD CONSTRAINT "voucher_batches_valid_check" CHECK ("validUntil" >= "validFrom");
ALTER TABLE "voucher_batches" ADD CONSTRAINT "voucher_batches_sites_check" CHECK (cardinality("siteIds") >= 1);
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_number_check" CHECK ("number" >= 1);
-- Used means when, where and by whom together; a voucher is never both used and cancelled.
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_redeemed_check" CHECK (("redeemedAt" IS NULL) = ("redeemedSiteId" IS NULL) AND ("redeemedAt" IS NULL) = ("redeemedById" IS NULL));
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_used_or_void_check" CHECK ("redeemedAt" IS NULL OR "voidedAt" IS NULL);
