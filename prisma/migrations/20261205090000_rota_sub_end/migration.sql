-- When a sub-activity placed on the Plan finishes (owner request, 22 October 2026). Additive: one nullable column.
ALTER TABLE "RotaAssignmentSub" ADD COLUMN IF NOT EXISTS "endMinutes" INTEGER;
