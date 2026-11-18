-- Plan (test): the times each person says they can usually work, sent from Turnfin Me (D34).
-- One row a person. Additive.
-- CreateTable
CREATE TABLE "plan_availability" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modes" TEXT[],
    "starts" INTEGER[],
    "ends" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_availability_userId_key" ON "plan_availability"("userId");

-- CreateIndex
CREATE INDEX "plan_availability_orgId_idx" ON "plan_availability"("orgId");
