-- Shared curriculum links are additive. Existing classes, swimmers, marks,
-- completion snapshots and enrolment references retain their original IDs.
-- The owner confirmed both sites teach the same curriculum. Match only exact
-- names (case/outer whitespace ignored), inside the same shared parent.
BEGIN;

ALTER TABLE "Programme" ADD COLUMN "sharedWithId" TEXT;
CREATE INDEX "Programme_sharedWithId_idx" ON "Programme"("sharedWithId");
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_sharedWithId_not_self" CHECK ("sharedWithId" IS DISTINCT FROM "id");

WITH ranked AS (
  SELECT item.id, FIRST_VALUE(item.id) OVER (
    PARTITION BY lower(btrim(item.name))
    ORDER BY (item."archivedAt" IS NOT NULL), item."createdAt", item.id
  ) AS canonical
  FROM "Programme" item
), linked AS (
  UPDATE "Programme" item SET "sharedWithId" = ranked.canonical
  FROM ranked WHERE item.id = ranked.id AND item.id <> ranked.canonical
  RETURNING item.id, item."sharedWithId"
)
INSERT INTO "AuditLog" (id, "actorName", action, entity, "entityId", summary)
SELECT 'shared-curriculum-Programme-' || id, 'Shared curriculum migration',
  'link-shared-curriculum', 'Programme', id,
  'Linked original Programme ' || id || ' to shared definition ' || "sharedWithId" || '. Original records and history retained.'
FROM linked;

ALTER TABLE "Level" ADD COLUMN "sharedWithId" TEXT;
CREATE INDEX "Level_sharedWithId_idx" ON "Level"("sharedWithId");
ALTER TABLE "Level" ADD CONSTRAINT "Level_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Level" ADD CONSTRAINT "Level_sharedWithId_not_self" CHECK ("sharedWithId" IS DISTINCT FROM "id");

WITH ranked AS (
  SELECT item.id, FIRST_VALUE(item.id) OVER (
    PARTITION BY COALESCE(parent."sharedWithId", parent.id), lower(btrim(item.name))
    ORDER BY (item."archivedAt" IS NOT NULL), item."createdAt", item.id
  ) AS canonical
  FROM "Level" item JOIN "Programme" parent ON parent.id = item."programmeId"
), linked AS (
  UPDATE "Level" item SET "sharedWithId" = ranked.canonical
  FROM ranked WHERE item.id = ranked.id AND item.id <> ranked.canonical
  RETURNING item.id, item."sharedWithId"
)
INSERT INTO "AuditLog" (id, "actorName", action, entity, "entityId", summary)
SELECT 'shared-curriculum-Level-' || id, 'Shared curriculum migration',
  'link-shared-curriculum', 'Level', id,
  'Linked original Level ' || id || ' to shared definition ' || "sharedWithId" || '. Original records and history retained.'
FROM linked;

ALTER TABLE "Competency" ADD COLUMN "sharedWithId" TEXT;
CREATE INDEX "Competency_sharedWithId_idx" ON "Competency"("sharedWithId");
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "Competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_sharedWithId_not_self" CHECK ("sharedWithId" IS DISTINCT FROM "id");

WITH ranked AS (
  SELECT item.id, FIRST_VALUE(item.id) OVER (
    PARTITION BY COALESCE(parent."sharedWithId", parent.id), lower(btrim(item.name))
    ORDER BY (item."archivedAt" IS NOT NULL), item."createdAt", item.id
  ) AS canonical
  FROM "Competency" item JOIN "Level" parent ON parent.id = item."levelId"
), linked AS (
  UPDATE "Competency" item SET "sharedWithId" = ranked.canonical
  FROM ranked WHERE item.id = ranked.id AND item.id <> ranked.canonical
  RETURNING item.id, item."sharedWithId"
)
INSERT INTO "AuditLog" (id, "actorName", action, entity, "entityId", summary)
SELECT 'shared-curriculum-Competency-' || id, 'Shared curriculum migration',
  'link-shared-curriculum', 'Competency', id,
  'Linked original Competency ' || id || ' to shared definition ' || "sharedWithId" || '. Original records and history retained.'
FROM linked;

ALTER TABLE "AssessmentType" ADD COLUMN "sharedWithId" TEXT;
CREATE INDEX "AssessmentType_sharedWithId_idx" ON "AssessmentType"("sharedWithId");
ALTER TABLE "AssessmentType" ADD CONSTRAINT "AssessmentType_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "AssessmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentType" ADD CONSTRAINT "AssessmentType_sharedWithId_not_self" CHECK ("sharedWithId" IS DISTINCT FROM "id");

WITH ranked AS (
  SELECT item.id, FIRST_VALUE(item.id) OVER (
    PARTITION BY COALESCE(parent."sharedWithId", parent.id), lower(btrim(item.name))
    ORDER BY (item."archivedAt" IS NOT NULL), item."createdAt", item.id
  ) AS canonical
  FROM "AssessmentType" item JOIN "Programme" parent ON parent.id = item."programmeId"
), linked AS (
  UPDATE "AssessmentType" item SET "sharedWithId" = ranked.canonical
  FROM ranked WHERE item.id = ranked.id AND item.id <> ranked.canonical
  RETURNING item.id, item."sharedWithId"
)
INSERT INTO "AuditLog" (id, "actorName", action, entity, "entityId", summary)
SELECT 'shared-curriculum-AssessmentType-' || id, 'Shared curriculum migration',
  'link-shared-curriculum', 'AssessmentType', id,
  'Linked original AssessmentType ' || id || ' to shared definition ' || "sharedWithId" || '. Original records and history retained.'
FROM linked;

CREATE INDEX "Student_status_lastName_firstName_idx" ON "Student"("status", "lastName", "firstName");
COMMIT;
