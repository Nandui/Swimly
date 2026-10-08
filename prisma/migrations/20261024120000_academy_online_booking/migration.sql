-- Academy online booking (owner decision, 8 October 2026; docs/academy.md). Additive only.
-- AlterTable
ALTER TABLE "AcademyCourse" ADD COLUMN     "bookOnline" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AcademyCandidate" ADD COLUMN     "callBy" TIMESTAMP(3),
ADD COLUMN     "callTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "phone2" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'staff';

-- CreateTable
CREATE TABLE "AcademyCall" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "amountCents" INTEGER,
    "receipt" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "byId" TEXT,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademyCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademyEmailCheck" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL DEFAULT '',
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "tokenHash" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademyEmailCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcademyCall_candidateId_createdAt_idx" ON "AcademyCall"("candidateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AcademyEmailCheck_tokenHash_key" ON "AcademyEmailCheck"("tokenHash");

-- CreateIndex
CREATE INDEX "AcademyEmailCheck_email_createdAt_idx" ON "AcademyEmailCheck"("email", "createdAt");

-- CreateIndex
CREATE INDEX "AcademyEmailCheck_ipHash_createdAt_idx" ON "AcademyEmailCheck"("ipHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AcademyCandidate_reference_key" ON "AcademyCandidate"("reference");

-- CreateIndex
CREATE INDEX "AcademyCandidate_source_payment_status_idx" ON "AcademyCandidate"("source", "payment", "status");

-- AddForeignKey
ALTER TABLE "AcademyCall" ADD CONSTRAINT "AcademyCall_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "AcademyCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

