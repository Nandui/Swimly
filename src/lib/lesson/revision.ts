import { createHash } from "node:crypto";
export const lessonRevision = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function attendanceFingerprint(
  ids: string[],
  rows: {
    studentId: string;
    status: string;
    note: string | null;
    markedAt: Date;
  }[],
  note: string,
) {
  return lessonRevision([
    [...ids].sort(),
    rows
      .map((row) => [
        row.studentId,
        row.status,
        row.note ?? "",
        row.markedAt.toISOString(),
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    note,
  ]);
}
