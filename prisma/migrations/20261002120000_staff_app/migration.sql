-- Turnfin Me (the staff app) and its API. Additive only: new nullable User
-- columns and new tables; nothing existing changes.

ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "homeAddress" TEXT;
ALTER TABLE "User" ADD COLUMN "emergencyName" TEXT;
ALTER TABLE "User" ADD COLUMN "emergencyPhone" TEXT;
ALTER TABLE "User" ADD COLUMN "emergencyRelationship" TEXT;

CREATE TABLE "StaffSignInChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'sign-in',
    "sessionId" TEXT,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffSignInChallenge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StaffSignInChallenge_purpose_check" CHECK ("purpose" IN ('sign-in', 'confirm'))
);
CREATE INDEX "StaffSignInChallenge_userId_createdAt_idx" ON "StaffSignInChallenge"("userId", "createdAt");

CREATE TABLE "StaffSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StaffSession_tokenHash_key" ON "StaffSession"("tokenHash");
CREATE INDEX "StaffSession_userId_idx" ON "StaffSession"("userId");

CREATE TABLE "StaffDetailChangeRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "proposed" JSONB NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reply" TEXT NOT NULL DEFAULT '',
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffDetailChangeRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StaffDetailChangeRequest_status_check" CHECK ("status" IN ('PENDING', 'APPLIED', 'DECLINED'))
);
CREATE INDEX "StaffDetailChangeRequest_orgId_status_idx" ON "StaffDetailChangeRequest"("orgId", "status");
CREATE INDEX "StaffDetailChangeRequest_userId_idx" ON "StaffDetailChangeRequest"("userId");

CREATE TABLE "QualificationEvidence" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "typeId" TEXT,
    "typeName" TEXT NOT NULL DEFAULT '',
    "issuedOn" DATE,
    "expiresOn" DATE,
    "reference" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "qualificationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QualificationEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "QualificationEvidence_status_check" CHECK ("status" IN ('PENDING', 'VERIFIED', 'DECLINED')),
    CONSTRAINT "QualificationEvidence_size_check" CHECK ("size" > 0 AND "size" <= 5242880)
);
CREATE INDEX "QualificationEvidence_orgId_status_idx" ON "QualificationEvidence"("orgId", "status");
CREATE INDEX "QualificationEvidence_userId_idx" ON "QualificationEvidence"("userId");

CREATE TABLE "StaffNotificationPreference" (
    "userId" TEXT NOT NULL,
    "trainingDue" BOOLEAN NOT NULL DEFAULT true,
    "qualificationExpiry" BOOLEAN NOT NULL DEFAULT true,
    "readingOverdue" BOOLEAN NOT NULL DEFAULT true,
    "shiftChanges" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffNotificationPreference_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "StaffReminderLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffReminderLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StaffReminderLog_userId_kind_ref_key" ON "StaffReminderLog"("userId", "kind", "ref");
