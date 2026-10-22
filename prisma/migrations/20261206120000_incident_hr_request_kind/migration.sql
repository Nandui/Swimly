-- Asking HR from a report can now also let HR know a staff member was in the incident
-- (owner request, 22 October 2026). Additive: three columns with defaults, so existing
-- requests stay wellbeing checks.
ALTER TABLE "incidents_wellbeing_checks" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'wellbeing';
ALTER TABLE "incidents_wellbeing_checks" ADD COLUMN IF NOT EXISTS "followUps" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "incidents_wellbeing_checks" ADD COLUMN IF NOT EXISTS "shareReport" BOOLEAN NOT NULL DEFAULT false;
