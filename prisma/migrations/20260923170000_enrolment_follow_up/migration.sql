CREATE TABLE "StudentFollowUp" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "studentId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "clubName" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "occurredOn" DATE NOT NULL,
    "nextContactOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentFollowUp_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StudentFollowUp_channel_check" CHECK ("channel" IN ('PHONE','EMAIL','IN_PERSON','SMS','INTERNAL')),
    CONSTRAINT "StudentFollowUp_outcome_check" CHECK ("outcome" IN ('CONTACTED','NO_REPLY','PARENT_NOT_READY','NO_SUITABLE_CLASS','AWAITING_PARENT','READY_TO_ENROL')),
    CONSTRAINT "StudentFollowUp_nextContact_check" CHECK ("nextContactOn" IS NULL OR "nextContactOn" >= "occurredOn")
);
CREATE UNIQUE INDEX "StudentFollowUp_sequence_key" ON "StudentFollowUp"("sequence");
CREATE UNIQUE INDEX "StudentFollowUp_studentId_operationId_key" ON "StudentFollowUp"("studentId", "operationId");
CREATE INDEX "StudentFollowUp_studentId_sequence_idx" ON "StudentFollowUp"("studentId", "sequence");
ALTER TABLE "StudentFollowUp" ADD CONSTRAINT "StudentFollowUp_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
