-- One log, one shape (docs/how-turnfin-works.md): every entry names its module.
-- Additive only: a nullable column and an index; older entries stay as they are.

ALTER TABLE "AuditLog" ADD COLUMN "module" TEXT;
CREATE INDEX "AuditLog_module_createdAt_idx" ON "AuditLog"("module", "createdAt");
