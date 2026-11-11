-- Plan (test): the tasks chosen for one duty block on the Day, from the duty's own list.
-- AlterTable
ALTER TABLE "plan_blocks" ADD COLUMN "taskIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
