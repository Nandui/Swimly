-- Purchasing (docs/purchasing.md): retail details on approved products (brand, the sizes and
-- colours it comes in) and on order lines (the brand, size and colour ordered). Additive only;
-- existing products and lines get empty values.

-- AlterTable
ALTER TABLE "PurchaseProduct" ADD COLUMN     "brand" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "colours" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sizes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "brand" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "colour" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "size" TEXT NOT NULL DEFAULT '';
