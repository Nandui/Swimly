-- Turnfin Courses (docs/courses.md, D34): its own accounts, sessions and log.
-- Only adds: three new tables, nothing existing is touched.

-- CreateTable
CREATE TABLE "courses_accounts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "personId" TEXT,
    "siteIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "grants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedSignIns" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastSignInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses_sessions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses_log" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "accountId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "record" TEXT,
    "recordId" TEXT,
    "siteId" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courses_accounts_email_key" ON "courses_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "courses_accounts_personId_key" ON "courses_accounts"("personId");

-- CreateIndex
CREATE INDEX "courses_accounts_orgId_idx" ON "courses_accounts"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "courses_sessions_tokenHash_key" ON "courses_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "courses_sessions_accountId_idx" ON "courses_sessions"("accountId");

-- CreateIndex
CREATE INDEX "courses_sessions_expiresAt_idx" ON "courses_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "courses_log_orgId_createdAt_idx" ON "courses_log"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "courses_log_record_recordId_idx" ON "courses_log"("record", "recordId");

-- CreateIndex
CREATE INDEX "courses_log_accountId_createdAt_idx" ON "courses_log"("accountId", "createdAt");

-- AddForeignKey
ALTER TABLE "courses_sessions" ADD CONSTRAINT "courses_sessions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "courses_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
