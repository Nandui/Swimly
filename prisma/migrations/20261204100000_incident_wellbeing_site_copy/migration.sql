-- Who is copied on wellbeing check requests about one site (owner request, 22 October 2026). Additive: one column.
ALTER TABLE "incidents_settings" ADD COLUMN IF NOT EXISTS "wellbeingCcBySite" JSONB NOT NULL DEFAULT '{}';
