-- Short courses and Academy courses book people from the swimmer records (owner request,
-- 21 October 2026). Additive: one optional column and its index on each table. Existing bookings
-- keep a null id until the desk links them.
ALTER TABLE "short_courses_participants" ADD COLUMN IF NOT EXISTS "swimmerId" TEXT;
CREATE INDEX IF NOT EXISTS "short_courses_participants_swimmerId_idx" ON "short_courses_participants"("swimmerId");

ALTER TABLE "AcademyCandidate" ADD COLUMN IF NOT EXISTS "swimmerId" TEXT;
CREATE INDEX IF NOT EXISTS "AcademyCandidate_swimmerId_idx" ON "AcademyCandidate"("swimmerId");
