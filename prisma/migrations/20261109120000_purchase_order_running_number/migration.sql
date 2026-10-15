-- Purchasing (docs/purchasing.md): order numbers become site code, month and one running number
-- for the organisation ("BT-OCT-0042"), kept on the organisation's settings. Additive only.

-- AlterTable
ALTER TABLE "PurchasingSettings" ADD COLUMN IF NOT EXISTS "lastOrderNumber" INTEGER NOT NULL DEFAULT 0;
