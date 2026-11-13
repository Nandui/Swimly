-- Plan (test): asking staff to cover a gap (D31). The Google Chat space each department's
-- requests go to at a site, the requests, and each person's answer. Additive.
-- CreateTable
CREATE TABLE "plan_chat_spaces" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "space" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "linkedById" TEXT NOT NULL,
    "linkedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_chat_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_cover_requests" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "needKey" TEXT NOT NULL,
    "dutyId" TEXT NOT NULL,
    "sessionId" TEXT,
    "classSource" TEXT,
    "classRef" TEXT,
    "departmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "place" TEXT NOT NULL DEFAULT '',
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "askedById" TEXT NOT NULL,
    "askedByName" TEXT NOT NULL,
    "chatMessage" TEXT,
    "closedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "chosenUserId" TEXT,
    "closedById" TEXT,
    "closedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_cover_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_cover_offers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_cover_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_chat_spaces_orgId_idx" ON "plan_chat_spaces"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "plan_chat_spaces_siteId_departmentId_key" ON "plan_chat_spaces"("siteId", "departmentId");

-- CreateIndex
CREATE INDEX "plan_cover_requests_orgId_siteId_date_idx" ON "plan_cover_requests"("orgId", "siteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "plan_cover_offers_requestId_userId_key" ON "plan_cover_offers"("requestId", "userId");

-- AddForeignKey
ALTER TABLE "plan_cover_offers" ADD CONSTRAINT "plan_cover_offers_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "plan_cover_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
