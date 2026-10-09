-- Owner request, 9 October 2026: each assessment session can set the ages it is for. Both ends
-- are nullable, so every existing session stays open to any age; adding them is additive.
ALTER TABLE "AssessmentSession" ADD COLUMN "minAge" INTEGER;
ALTER TABLE "AssessmentSession" ADD COLUMN "maxAge" INTEGER;
