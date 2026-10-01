-- Accounts added on the Users page before it set the organisation were saved
-- without one, so organisation-scoped lists (rota absences, people, PIN sign-in)
-- skipped them. Same backfill as 20260928120000_people_core. Idempotent.
UPDATE "User" SET "orgId" = (SELECT "id" FROM "Organisation" WHERE "slug" = 'leisureworld') WHERE "orgId" IS NULL;
