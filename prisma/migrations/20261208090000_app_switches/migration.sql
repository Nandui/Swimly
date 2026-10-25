-- App switches (roadmap step 2): whether each app is on, off or on only at some sites, per
-- organisation. Additive: one new table. No row means on everywhere, so nothing changes until
-- a superadmin sets a switch in Admin › Apps.

-- CreateTable
CREATE TABLE IF NOT EXISTS "app_switches" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'on',
    "siteIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_switches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "app_switches_state_check" CHECK ("state" IN ('on', 'off', 'sites'))
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "app_switches_orgId_appId_key" ON "app_switches"("orgId", "appId");

-- AddForeignKey
ALTER TABLE "app_switches" ADD CONSTRAINT "app_switches_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
