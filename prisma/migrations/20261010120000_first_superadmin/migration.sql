-- The organisation's first superadmin (owner request, 1 October 2026).
-- Superadmins shipped with nobody assigned, and scripts/grant-superadmin.ts
-- needs production credentials, so the owner's account is made the first one
-- here, with a line in the shared log. It does nothing once any active
-- superadmin exists, or if the account is missing, inactive or has no
-- organisation. Further superadmins are made on their Staff page.
WITH owner AS (
  SELECT "id", "name" FROM "User"
  WHERE lower("email") = 'fernandoserina@leisureworldcork.com' AND "isActive" AND "orgId" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "User" WHERE "isSuperadmin" AND "isActive")
), granted AS (
  UPDATE "User" AS u SET "isSuperadmin" = true FROM owner WHERE u."id" = owner."id"
  RETURNING u."id", u."name"
)
INSERT INTO "AuditLog" ("id", "actorName", "action", "entity", "entityId", "module", "summary")
SELECT 'audit_first_superadmin', 'Database migration', 'grant-superadmin', 'User', "id", 'Admin', 'Made ' || "name" || ' the first superadmin'
FROM granted;
