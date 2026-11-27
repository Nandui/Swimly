-- Turnfin Courses (docs/courses.md, D34): its sessions, sign-in guard and log.
-- Only adds: three new tables, nothing existing is touched.

-- CreateTable
CREATE TABLE "courses_sign_ins" (
    "userId" TEXT NOT NULL,
    "failedSignIns" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastSignInAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_sign_ins_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "courses_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
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
    "userId" TEXT,
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
CREATE UNIQUE INDEX "courses_sessions_tokenHash_key" ON "courses_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "courses_sessions_userId_idx" ON "courses_sessions"("userId");

-- CreateIndex
CREATE INDEX "courses_sessions_expiresAt_idx" ON "courses_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "courses_log_orgId_createdAt_idx" ON "courses_log"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "courses_log_record_recordId_idx" ON "courses_log"("record", "recordId");

-- CreateIndex
CREATE INDEX "courses_log_userId_createdAt_idx" ON "courses_log"("userId", "createdAt");
