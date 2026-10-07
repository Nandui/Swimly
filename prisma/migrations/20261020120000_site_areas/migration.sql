-- Admin setup (owner decision, 7 October 2026): each site's areas, kept in Admin, that the rota's
-- activities and bookings and the swim school's classes and assessments pick from. Additive only.
-- The activity list keeps its table ("RotaActivityType"); it is Admin's now, so nothing moves.

CREATE TABLE "SiteArea" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteArea_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SiteArea_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 60)
);

CREATE INDEX "SiteArea_orgId_idx" ON "SiteArea"("orgId");
CREATE UNIQUE INDEX "SiteArea_siteId_name_key" ON "SiteArea"("siteId", "name");
ALTER TABLE "SiteArea" ADD CONSTRAINT "SiteArea_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every place already typed at a site becomes one of its areas. A swim class's location may add a
-- detail after a comma ("Learner pool, lane 3"); the area is the part before it.
INSERT INTO "SiteArea" ("id", "orgId", "siteId", "name", "sortOrder", "updatedAt")
SELECT 'area_' || md5(p."siteId" || '|' || lower(p."name")), c."orgId", p."siteId", min(p."name"), 0, CURRENT_TIMESTAMP
FROM (
  SELECT "siteId", btrim("place") AS "name" FROM "RotaNeed"
  UNION ALL SELECT "siteId", btrim("place") FROM "RotaRepeat"
  UNION ALL SELECT "siteId", btrim("place") FROM "RotaBooking"
  UNION ALL SELECT "clubId", btrim(split_part("location", ',', 1)) FROM "Course" WHERE "location" IS NOT NULL
  UNION ALL SELECT "clubId", btrim(split_part("location", ',', 1)) FROM "AssessmentSession" WHERE "location" IS NOT NULL
) p
JOIN "Club" c ON c."id" = p."siteId"
WHERE c."orgId" IS NOT NULL AND length(p."name") BETWEEN 1 AND 60
GROUP BY p."siteId", lower(p."name"), c."orgId"
ON CONFLICT DO NOTHING;
