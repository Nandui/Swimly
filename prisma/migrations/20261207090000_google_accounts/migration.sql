-- Google-only sign-in (owner request and approval, 23 October 2026): a first Sign in
-- with Google makes the account, and every one keeps the name and picture fresh.
-- Additive: three nullable columns and a unique index that ignores nulls.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastSignInAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
