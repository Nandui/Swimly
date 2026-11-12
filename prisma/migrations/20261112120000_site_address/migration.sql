-- A site's postal address, for purchase order deliveries (owner request, 15 October 2026). Additive.
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "address" TEXT NOT NULL DEFAULT '';
