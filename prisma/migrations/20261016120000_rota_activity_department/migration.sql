-- Rota: an activity to cover belongs to a department (owner decision, 5 October 2026: department
-- supervisors plan their department's week, its shifts and its activities). Additive only: one
-- nullable column; existing activities stay site-wide.

ALTER TABLE "RotaActivity" ADD COLUMN "departmentId" TEXT;

CREATE INDEX "RotaActivity_departmentId_idx" ON "RotaActivity"("departmentId");
ALTER TABLE "RotaActivity" ADD CONSTRAINT "RotaActivity_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
