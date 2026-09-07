ALTER TABLE "Enrolment" ADD COLUMN "scheduledEndOn" DATE;
CREATE INDEX "Enrolment_status_scheduledEndOn_idx" ON "Enrolment"("status", "scheduledEndOn");
