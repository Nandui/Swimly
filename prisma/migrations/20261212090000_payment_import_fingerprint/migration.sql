-- Payments (owner, 2 November 2026): the same failure sheet uploaded again under another month is
-- refused, so each upload keeps a hash of its debits. Additive: one column with a default, one index.
ALTER TABLE "payment_imports" ADD COLUMN IF NOT EXISTS "fingerprint" TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS "payment_imports_orgId_fingerprint_idx" ON "payment_imports"("orgId", "fingerprint");
