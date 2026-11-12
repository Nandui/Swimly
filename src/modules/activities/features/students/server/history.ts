import type { z } from "zod";
import type { evidenceSchema, historyQuerySchema } from "@/modules/activities/features/students/server/history-schemas";
import { ArrowRightLeft, Award, ClipboardCheck, ClipboardList, List, ListChecks, UserRound } from "lucide-react";
import type { StatusMeta } from "@/lib/status";
import { DAY_META } from "@/modules/activities/shared/courses/constants";
import { minutesNow, parseDateOnly, today, toDateOnlyString, weekdayOf } from "@/lib/format";
import type { StudentEnrolment } from "@/modules/activities/shared/enrolment/data/enrolments";

export const HISTORY_KINDS = ["all", "competencies", "attendance", "enrolment", "completion", "assessment", "profile"] as const;
export type HistoryKind = typeof HISTORY_KINDS[number];
/** Event kinds, not statuses: every one is gray, told apart by its icon. */
export const HISTORY_META = {
  all: { label: "All activity", color: "gray", icon: List }, competencies: { label: "Competencies", color: "gray", icon: ListChecks },
  attendance: { label: "Attendance", color: "gray", icon: ClipboardList }, enrolment: { label: "Enrolments & moves", color: "gray", icon: ArrowRightLeft },
  completion: { label: "Level milestones", color: "gray", icon: Award }, assessment: { label: "Assessments", color: "gray", icon: ClipboardCheck },
  profile: { label: "Profile", color: "gray", icon: UserRound },
} as const satisfies Record<string, StatusMeta>;
type HistoryEvidence = z.infer<typeof evidenceSchema>;
export type HistoryEvent = {
  id: string; at: string; date: string; kind: Exclude<HistoryKind, "all">; title: string;
  actor: string | null; courseId: string | null; programmeId: string | null; levelId: string | null;
  site: string | null; className: string | null; snapshot: boolean; evidence: HistoryEvidence | null;
};
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
