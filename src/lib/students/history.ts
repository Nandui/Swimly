import { z } from "zod";
import { DAY_META } from "@/lib/courses/constants";
import { minutesNow, parseDateOnly, today, toDateOnlyString, weekdayOf } from "@/lib/format";
import type { StudentEnrolment } from "@/lib/enrolment/data/enrolments";

export const HISTORY_KINDS = ["all", "competencies", "attendance", "enrolment", "completion", "assessment", "profile"] as const;
export type HistoryKind = typeof HISTORY_KINDS[number];
export const HISTORY_META = {
  all: { label: "All activity", color: "gray" }, competencies: { label: "Competencies", color: "green" },
  attendance: { label: "Attendance", color: "blue" }, enrolment: { label: "Enrolments & moves", color: "gray" },
  completion: { label: "Level milestones", color: "green" }, assessment: { label: "Assessments", color: "blue" },
  profile: { label: "Profile", color: "gray" },
} as const;
export const HISTORY_MARKS: Record<string, string> = { ACHIEVED: "Achieved", WORKING_ON: "Not Achieved", PRESENT: "Present", ABSENT: "Absent", LATE: "Late" };
const mark = z.enum(["ACHIEVED", "WORKING_ON"]).nullable();
export const evidenceSchema = z.object({
  version: z.literal(1), kind: z.string(), date: z.string().optional(), courseId: z.string().nullable().optional(),
  levelId: z.string().optional(), before: z.string().nullable().optional(), after: z.string().nullable().optional(),
  note: z.string().nullable().optional(), previousNote: z.string().nullable().optional(), taughtBy: z.string().nullable().optional(),
  changes: z.array(z.object({ competencyId: z.string(), name: z.string(), before: mark, after: mark })).optional(),
});
export type HistoryEvidence = z.infer<typeof evidenceSchema>;
export type HistoryEvent = {
  id: string; at: string; date: string; kind: Exclude<HistoryKind, "all">; title: string;
  actor: string | null; courseId: string | null; programmeId: string | null; levelId: string | null;
  site: string | null; className: string | null; snapshot: boolean; evidence: HistoryEvidence | null;
};
export const historyQuerySchema = z.object({
  kind: z.enum(HISTORY_KINDS).optional(), courseId: z.string().max(100).optional(),
  programmeId: z.string().max(100).optional(), competencyId: z.string().max(100).optional(),
  from: z.string().max(10).optional(), to: z.string().max(10).optional(), q: z.string().max(160).optional(),
  cursor: z.object({ at: z.iso.datetime(), id: z.string().max(150) }).optional(),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
export type HistoryPage = { events: HistoryEvent[]; next: HistoryQuery["cursor"] | null; canAudit: boolean };

/** Next weekly start, respecting an authorised scheduled end and the school clock. */
export function nextLesson(enrolments: StudentEnrolment[], instant = new Date()) {
  const iso = today(instant), current = parseDateOnly(iso);
  const weekday = DAY_META[weekdayOf(current) as keyof typeof DAY_META].index;
  return enrolments.filter(e => e.status === "ACTIVE" && !e.course.archivedAt).flatMap(e => {
    let days = (DAY_META[e.course.dayOfWeek].index - weekday + 7) % 7;
    if (!days && e.course.startMinutes <= minutesNow(instant)) days = 7;
    let date = new Date(current.getTime() + days * 86400000);
    while (date < e.startedOn) date = new Date(date.getTime() + 7 * 86400000);
    if (e.scheduledEndOn && date >= e.scheduledEndOn) return [];
    return [{ enrolment: e, date: toDateOnlyString(date) }];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.enrolment.course.startMinutes - b.enrolment.course.startMinutes)[0] ?? null;
}

export function chapterOrder(enrolments: StudentEnrolment[]) {
  return [...enrolments].sort((a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") || b.startedOn.getTime() - a.startedOn.getTime() || a.id.localeCompare(b.id));
}
