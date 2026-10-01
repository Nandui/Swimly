-- Return to work after an absence (docs/rota.md). Additive: new nullable or
-- defaulted columns only, so code still on the old schema keeps working.
ALTER TABLE "RotaAbsence" ADD COLUMN "returnMetOn" DATE;
ALTER TABLE "RotaAbsence" ADD COLUMN "returnFit" TEXT;
ALTER TABLE "RotaAbsence" ADD COLUMN "returnAdjustments" TEXT NOT NULL DEFAULT '';
ALTER TABLE "RotaAbsence" ADD COLUMN "returnFitNote" BOOLEAN;
ALTER TABLE "RotaAbsence" ADD COLUMN "returnNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "RotaAbsence" ADD COLUMN "returnById" TEXT;
ALTER TABLE "RotaAbsence" ADD COLUMN "returnByName" TEXT;
ALTER TABLE "RotaAbsence" ADD CONSTRAINT "RotaAbsence_returnFit_check" CHECK ("returnFit" IS NULL OR "returnFit" IN ('fit', 'adjusted'));
