CREATE TABLE "ParentAccessRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "parentId" TEXT NOT NULL REFERENCES "ParentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "key" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "childFingerprint" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "dateOfBirth" DATE NOT NULL,
  "context" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'APPROVED', 'DECLINED')),
  "studentId" TEXT REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reviewedById" TEXT,
  "reviewedByName" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reply" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ParentAccessRequest_parentId_key_key" ON "ParentAccessRequest"("parentId", "key");
CREATE INDEX "ParentAccessRequest_parentId_createdAt_idx" ON "ParentAccessRequest"("parentId", "createdAt");
CREATE INDEX "ParentAccessRequest_status_createdAt_idx" ON "ParentAccessRequest"("status", "createdAt");
CREATE UNIQUE INDEX "ParentAccessRequest_one_pending_child" ON "ParentAccessRequest"("parentId", "childFingerprint") WHERE "status" = 'PENDING';
