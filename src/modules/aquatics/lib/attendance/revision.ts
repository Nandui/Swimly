import { createHash } from "node:crypto";
import type { AttendanceStatus } from "@/generated/prisma/client";

export type SavedRegister = {
  revision: string;
  marks: Record<string, { status: AttendanceStatus; note: string }>;
  note: string;
};

/** Content revision: unchanged retries stay harmless, even after a timeout.
 *  The class/date are included so a revision cannot be reused for another sheet.
 *  Names and recorder metadata are deliberately absent from the client payload. */
export function savedRegister(
  courseId: string,
  date: string,
  rows: { studentId: string; status: AttendanceStatus; note: string | null }[],
  note: string | null | undefined,
): SavedRegister {
  const entries = rows.map(row => [row.studentId, row.status, row.note ?? ""] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  return {
    revision: createHash("sha256").update(JSON.stringify([courseId, date, entries, note ?? ""])).digest("hex"),
    marks: Object.fromEntries(entries.map(([id, status, note]) => [id, { status, note }])),
    note: note ?? "",
  };
}
