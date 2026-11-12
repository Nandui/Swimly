-- Who first told the reporter (owner decision, 12 October 2026: only duty managers and supervisors report).
ALTER TABLE "incidents_reports" ADD COLUMN "raisedBy" TEXT NOT NULL DEFAULT '';
