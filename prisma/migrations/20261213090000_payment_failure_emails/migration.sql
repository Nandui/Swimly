-- Failed payments (owner, 2 November 2026): reception sends the family up to three warning emails.
-- Additive: three columns with defaults.
ALTER TABLE "payment_failures" ADD COLUMN IF NOT EXISTS "emailsSent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payment_failures" ADD COLUMN IF NOT EXISTS "firstEmailAt" TIMESTAMP(3);
ALTER TABLE "payment_failures" ADD COLUMN IF NOT EXISTS "lastEmailAt" TIMESTAMP(3);
