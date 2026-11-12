-- Owner decision, 22 October 2026: Fernando Serina's own account is a real operations
-- manager, so it is no longer marked as system; a separate developer login will be marked
-- from its Staff page instead. Undoes only what 20261202120000_system_place_changes marked
-- for that account (nothing else had been marked when it ran). Nothing is deleted.
UPDATE "AuditLog" a SET "system" = false
FROM "User" u
WHERE lower(btrim(u.name)) = 'fernando serina' AND u."actsAsSystem"
  AND (a."actorId" = u.id OR (a."actorId" IS NULL AND a."actorName" = u.name))
  AND a."system";

UPDATE "User" SET "actsAsSystem" = false WHERE lower(btrim(name)) = 'fernando serina';
