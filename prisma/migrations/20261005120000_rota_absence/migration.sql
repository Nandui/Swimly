-- Rota absences: someone off work (sickness and other reasons). Additive only: one new table.

CREATE TABLE "RotaAbsence" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "firstDay" DATE NOT NULL,
    "lastDay" DATE,
    "note" TEXT NOT NULL DEFAULT '',
    "reportedById" TEXT,
    "reportedByName" TEXT NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotaAbsence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RotaAbsence_orgId_firstDay_idx" ON "RotaAbsence"("orgId", "firstDay");
CREATE INDEX "RotaAbsence_userId_firstDay_idx" ON "RotaAbsence"("userId", "firstDay");

ALTER TABLE "RotaAbsence" ADD CONSTRAINT "RotaAbsence_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RotaAbsence" ADD CONSTRAINT "RotaAbsence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The last day, when known, is on or after the first.
ALTER TABLE "RotaAbsence" ADD CONSTRAINT "RotaAbsence_days_check" CHECK ("lastDay" IS NULL OR "lastDay" >= "firstDay");
