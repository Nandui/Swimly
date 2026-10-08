-- CreateTable
CREATE TABLE "RotaPlanShift" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "userId" TEXT NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotaPlanShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotaBreak" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "userId" TEXT NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL,
    "byId" TEXT,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RotaBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RotaPlanShift_siteId_date_idx" ON "RotaPlanShift"("siteId", "date");

-- CreateIndex
CREATE INDEX "RotaPlanShift_userId_date_idx" ON "RotaPlanShift"("userId", "date");

-- CreateIndex
CREATE INDEX "RotaBreak_siteId_date_idx" ON "RotaBreak"("siteId", "date");

-- CreateIndex
CREATE INDEX "RotaBreak_userId_date_idx" ON "RotaBreak"("userId", "date");

-- AddForeignKey
ALTER TABLE "RotaPlanShift" ADD CONSTRAINT "RotaPlanShift_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaPlanShift" ADD CONSTRAINT "RotaPlanShift_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaPlanShift" ADD CONSTRAINT "RotaPlanShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaBreak" ADD CONSTRAINT "RotaBreak_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaBreak" ADD CONSTRAINT "RotaBreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Times are minutes past midnight; a shift is at least 15 minutes, a break 5 to 120.
ALTER TABLE "RotaPlanShift" ADD CONSTRAINT "RotaPlanShift_times_check" CHECK ("startMinutes" >= 0 AND "endMinutes" <= 1440 AND "endMinutes" - "startMinutes" >= 15);
ALTER TABLE "RotaBreak" ADD CONSTRAINT "RotaBreak_times_check" CHECK ("startMinutes" >= 0 AND "startMinutes" + "minutes" <= 1440 AND "minutes" BETWEEN 5 AND 120);
