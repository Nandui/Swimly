-- The triage questions for each kind of incident report (owner request, 19 October 2026). Additive.
ALTER TABLE "incidents_reports" ADD COLUMN IF NOT EXISTS "triageAnswers" JSONB NOT NULL DEFAULT '{}';
