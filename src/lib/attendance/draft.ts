import type { AttendanceStatus } from "@/generated/prisma/client";

export type DraftMark = { status: AttendanceStatus; note: string };
export type AttendanceDraft = { marks: Record<string, DraftMark>; note?: string; revision?: string | null };

/** Accept previous drafts, but never trust arbitrary localStorage as marks. */
export function parseAttendanceDraft(raw: string): AttendanceDraft | null {
  try {
    const stored: unknown = JSON.parse(raw);
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
    const record = stored as Record<string, unknown>;
    if (record.version !== undefined && record.version !== 1 && record.version !== 2) return null;
    const source = record.version === 1 || record.version === 2 ? record.marks : record;
    if (!source || typeof source !== "object" || Array.isArray(source)) return null;
    const marks: Record<string, DraftMark> = {};
    for (const [id, value] of Object.entries(source)) {
      if (!value || typeof value !== "object") continue;
      const mark = value as Record<string, unknown>;
      if (!["PRESENT", "ABSENT", "LATE"].includes(String(mark.status))) continue;
      marks[id] = { status: mark.status as AttendanceStatus, note: typeof mark.note === "string" ? mark.note : "" };
    }
    const draft: AttendanceDraft = { marks, note: record.version !== undefined && typeof record.note === "string" ? record.note : undefined };
    if (record.version === 2) draft.revision = typeof record.revision === "string" && /^[a-f0-9]{64}$/.test(record.revision) ? record.revision : null;
    return draft;
  } catch {
    return null;
  }
}
