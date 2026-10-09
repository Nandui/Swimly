-- Owner request, 9 October 2026: the classes in Done when the restore stage arrived were billed
-- before it, so their members still need putting back on their monthly price. Move every
-- billing-notified class that is neither processed nor restored to To restore, keeping who
-- notified billing and when. Runs once; classes marked later are untouched.
UPDATE "ClassCancellation"
SET "legendProcessedAt" = "billingNotifiedAt",
    "legendProcessedById" = "billingNotifiedById",
    "legendProcessedByName" = "billingNotifiedByName"
WHERE "billingNotifiedAt" IS NOT NULL
  AND "legendProcessedAt" IS NULL
  AND "restoredAt" IS NULL;
