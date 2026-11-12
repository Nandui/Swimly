-- Who is copied on every wellbeing check request to HR (owner request, 22 October 2026). Additive: one column.
ALTER TABLE "incidents_settings" ADD COLUMN IF NOT EXISTS "wellbeingCc" TEXT NOT NULL DEFAULT '';
