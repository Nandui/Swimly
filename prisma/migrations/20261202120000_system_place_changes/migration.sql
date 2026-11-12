-- Place changes done as scripted development work (owner request, 21 October 2026). Additive:
-- a flag on the account, a flag on its log entries, and Fernando Serina's account and past
-- enrolments, moves and unenrolments marked. Nothing is deleted; the actor stays recorded.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "actsAsSystem" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "system" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User" SET "actsAsSystem" = true WHERE lower(btrim(name)) = 'fernando serina';

UPDATE "AuditLog" a SET "system" = true
FROM "User" u
WHERE u."actsAsSystem"
  AND (a."actorId" = u.id OR (a."actorId" IS NULL AND a."actorName" = u.name))
  AND a.entity = 'Enrolment'
  AND a.action IN ('enrol', 'waitlist', 'transfer', 'transfer-out', 'withdraw', 'complete', 'schedule-withdrawal', 'cancel-withdrawal');
