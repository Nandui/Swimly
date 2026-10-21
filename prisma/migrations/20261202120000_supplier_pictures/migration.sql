-- A picture for each supplier in Purchasing (owner request, 21 October 2026). Additive:
-- the picture's bytes and their version, both empty until someone adds one.
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "pictureData" BYTEA;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "pictureVersion" TEXT;
