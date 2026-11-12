-- Areas belong to a department and can have sub-areas, one level (owner, 20 October 2026). Additive: two optional columns.
-- AlterTable
ALTER TABLE "SiteArea" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "parentId" TEXT;

-- AddForeignKey
ALTER TABLE "SiteArea" ADD CONSTRAINT "SiteArea_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteArea" ADD CONSTRAINT "SiteArea_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SiteArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

