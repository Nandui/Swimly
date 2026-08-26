-- Attendance is Present, Late or Absent. Postgres cannot drop a value from an
-- enum, so the type is rebuilt and the column recast. The cast is deliberately
-- unguarded: if any row still says EXCUSED this migration fails loudly rather
-- than silently rewriting somebody's register.
ALTER TYPE "AttendanceStatus" RENAME TO "AttendanceStatus_old";

CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE');

ALTER TABLE "AttendanceRecord"
  ALTER COLUMN "status" TYPE "AttendanceStatus"
  USING ("status"::text::"AttendanceStatus");

DROP TYPE "AttendanceStatus_old";
