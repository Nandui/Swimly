-- Parent change requests: parents propose corrections to contact, emergency
-- and medical details; reception reviews and applies them. Additive only.

CREATE TABLE "ParentChangeRequest" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "proposed" JSONB NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "reply" TEXT NOT NULL DEFAULT '',
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParentChangeRequest_status_createdAt_idx" ON "ParentChangeRequest"("status", "createdAt");

CREATE INDEX "ParentChangeRequest_studentId_idx" ON "ParentChangeRequest"("studentId");

CREATE UNIQUE INDEX "ParentChangeRequest_parentId_key_key" ON "ParentChangeRequest"("parentId", "key");

ALTER TABLE "ParentChangeRequest" ADD CONSTRAINT "ParentChangeRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentChangeRequest" ADD CONSTRAINT "ParentChangeRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "ParentChangeRequest" ADD CONSTRAINT "ParentChangeRequest_status_check" CHECK ("status" IN ('PENDING','APPLIED','DECLINED'));
