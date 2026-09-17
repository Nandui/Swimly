-- Additive: existing places are unverified, never silently marked as completed.
CREATE TYPE "LegendAgreementStatus" AS ENUM ('NEEDS_CHECK', 'PENDING', 'DONE');
ALTER TABLE "Enrolment"
  ADD COLUMN "legendAgreementStatus" "LegendAgreementStatus" NOT NULL DEFAULT 'NEEDS_CHECK',
  ADD COLUMN "legendAgreementUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "legendAgreementUpdatedById" TEXT,
  ADD COLUMN "legendAgreementUpdatedByName" TEXT;
CREATE INDEX "Enrolment_status_legendAgreementStatus_startedOn_idx"
  ON "Enrolment"("status", "legendAgreementStatus", "startedOn");
