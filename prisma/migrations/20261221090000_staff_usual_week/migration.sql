-- The platform: the times each person says they can usually work, sent from Turnfin Me (D34, D35).
-- One row a person, beside their contracted hours; Plan (test) and Staffing read it. Additive.
-- CreateTable
CREATE TABLE "staff_usual_weeks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modes" TEXT[],
    "starts" INTEGER[],
    "ends" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_usual_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_usual_weeks_userId_key" ON "staff_usual_weeks"("userId");

-- CreateIndex
CREATE INDEX "staff_usual_weeks_orgId_idx" ON "staff_usual_weeks"("orgId");
