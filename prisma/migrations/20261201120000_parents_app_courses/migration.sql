-- Swimming courses in the parents app (owner request, 21 October 2026). Additive: adult
-- accounts beside family ones, an adult's own swimmer record, and each site's reception phone.
ALTER TABLE "ParentAccount" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'family';
ALTER TABLE "ParentAccount" ADD COLUMN IF NOT EXISTS "swimmerId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ParentAccount_swimmerId_key" ON "ParentAccount"("swimmerId");

ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "phone" TEXT NOT NULL DEFAULT '';
