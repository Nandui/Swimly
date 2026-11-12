-- Plan (test): when each chosen task ends, set on the Day (same order as "taskIds").
-- AlterTable
ALTER TABLE "plan_blocks" ADD COLUMN "taskEndMinutes" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
