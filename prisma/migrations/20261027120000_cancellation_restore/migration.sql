-- AlterTable
ALTER TABLE "ClassCancellation" ADD COLUMN     "legendProcessedAt" TIMESTAMP(3),
ADD COLUMN     "legendProcessedById" TEXT,
ADD COLUMN     "legendProcessedByName" TEXT,
ADD COLUMN     "restoredAt" TIMESTAMP(3),
ADD COLUMN     "restoredById" TEXT,
ADD COLUMN     "restoredByName" TEXT;

-- CreateTable
CREATE TABLE "LegendAgreementPrice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyCents" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    "updatedByName" TEXT,

    CONSTRAINT "LegendAgreementPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegendAgreementPrice_name_key" ON "LegendAgreementPrice"("name");


-- The two agreement prices the swim school bills, without a price until someone sets it.
ALTER TABLE "LegendAgreementPrice" ADD CONSTRAINT "LegendAgreementPrice_check" CHECK (char_length("name") BETWEEN 2 AND 80 AND ("monthlyCents" IS NULL OR "monthlyCents" BETWEEN 0 AND 100000));
INSERT INTO "LegendAgreementPrice" ("id", "name", "updatedAt") VALUES
  ('lap_water_safety_fun', 'Water Safety & Fun', CURRENT_TIMESTAMP),
  ('lap_swimming_skills', 'Swimming Skills', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
