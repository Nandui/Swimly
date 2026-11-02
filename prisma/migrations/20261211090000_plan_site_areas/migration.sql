-- Plan (test) reads Admin › Areas (owner, 2 November 2026). Additive: one new column.
-- AlterTable
ALTER TABLE "plan_sessions" ADD COLUMN     "siteAreaId" TEXT;

