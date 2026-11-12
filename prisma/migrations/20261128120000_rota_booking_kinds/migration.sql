-- How many staff each kind of booking needs (owner, 20 October 2026). Additive: one new table.
-- CreateTable
CREATE TABLE "RotaBookingKind" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "staff" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByName" TEXT NOT NULL,

    CONSTRAINT "RotaBookingKind_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RotaBookingKind_orgId_kind_key" ON "RotaBookingKind"("orgId", "kind");

