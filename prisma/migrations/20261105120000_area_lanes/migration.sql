-- Pools with lanes (owner request, 13 October 2026; docs/rota.md): an area says how many lanes it
-- has, and the rota's activities and bookings say which lanes they take. Additive: existing
-- areas have no lanes and existing activities and bookings take their whole area.

-- AlterTable
ALTER TABLE "SiteArea" ADD COLUMN "lanes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RotaNeed" ADD COLUMN "lanes" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "RotaRepeat" ADD COLUMN "lanes" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
