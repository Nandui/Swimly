-- Plan (test): the time each chosen task is done at, set on the Day (same order as "taskIds").
-- AlterTable
ALTER TABLE "plan_blocks" ADD COLUMN "taskMinutes" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
