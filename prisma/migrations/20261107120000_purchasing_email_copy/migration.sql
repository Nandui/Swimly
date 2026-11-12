-- Purchasing (docs/purchasing.md): a copy (CC) of every email to a supplier for one address set
-- under Suppliers, kept on each email. Additive only.

-- AlterTable
ALTER TABLE "PurchasingSettings" ADD COLUMN     "copyTo" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "PurchaseOrderEmail" ADD COLUMN     "ccAddress" TEXT NOT NULL DEFAULT '';
