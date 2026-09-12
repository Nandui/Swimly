-- Additive: existing deployments can continue writing summary-only audit rows.
ALTER TABLE "AuditLog" ADD COLUMN "details" JSONB;
