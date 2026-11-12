-- Vouchers: batches of vouchers given to communities and organisations (a family swim at Christmas, for example), each voucher with its own code, used once at reception. Additive only.

-- CreateTable
CREATE TABLE "VoucherBatch" (
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

    CONSTRAINT "VoucherBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "redeemedSiteId" TEXT,
    "redeemedById" TEXT,
    "redeemedByName" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByName" TEXT,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoucherBatch_orgId_createdAt_idx" ON "VoucherBatch"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_batchId_number_key" ON "Voucher"("batchId", "number");

-- CreateIndex
CREATE INDEX "Voucher_redeemedSiteId_redeemedAt_idx" ON "Voucher"("redeemedSiteId", "redeemedAt");

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "VoucherBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_redeemedSiteId_fkey" FOREIGN KEY ("redeemedSiteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Guards the rules the app keeps.
ALTER TABLE "VoucherBatch" ADD CONSTRAINT "VoucherBatch_quantity_check" CHECK ("quantity" BETWEEN 1 AND 500);
ALTER TABLE "VoucherBatch" ADD CONSTRAINT "VoucherBatch_valid_check" CHECK ("validUntil" >= "validFrom");
ALTER TABLE "VoucherBatch" ADD CONSTRAINT "VoucherBatch_sites_check" CHECK (cardinality("siteIds") >= 1);
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_number_check" CHECK ("number" >= 1);
-- Used means when, where and by whom together; a voucher is never both used and cancelled.
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_redeemed_check" CHECK (("redeemedAt" IS NULL) = ("redeemedSiteId" IS NULL) AND ("redeemedAt" IS NULL) = ("redeemedById" IS NULL));
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_used_or_void_check" CHECK ("redeemedAt" IS NULL OR "voidedAt" IS NULL);
