-- Rota as the deployment plan (docs/rota.md). Additive: a department on each
-- duty, and the log of changes made once a duty's week has started.
ALTER TABLE "RotaShift" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "RotaShift" ADD CONSTRAINT "RotaShift_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "RotaShift_departmentId_idx" ON "RotaShift"("departmentId");

CREATE TABLE "RotaShiftChange" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "before" TEXT NOT NULL DEFAULT '',
    "after" TEXT NOT NULL DEFAULT '',
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "reason" TEXT NOT NULL,
    "absenceId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "byId" TEXT,
    "byName" TEXT NOT NULL,
    "timepointAt" TIMESTAMP(3),
    "timepointById" TEXT,
    "timepointByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RotaShiftChange_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RotaShiftChange_kind_check" CHECK ("kind" IN ('added', 'changed', 'cancelled')),
    CONSTRAINT "RotaShiftChange_reason_check" CHECK ("reason" IN ('cover', 'swap', 'extra', 'correction'))
);
CREATE INDEX "RotaShiftChange_orgId_date_idx" ON "RotaShiftChange"("orgId", "date");
CREATE INDEX "RotaShiftChange_shiftId_idx" ON "RotaShiftChange"("shiftId");
CREATE INDEX "RotaShiftChange_fromUserId_idx" ON "RotaShiftChange"("fromUserId");
CREATE INDEX "RotaShiftChange_toUserId_idx" ON "RotaShiftChange"("toUserId");
ALTER TABLE "RotaShiftChange" ADD CONSTRAINT "RotaShiftChange_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "RotaShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
