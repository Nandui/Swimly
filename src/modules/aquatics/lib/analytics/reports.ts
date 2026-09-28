import { minutesNow, today } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";
import { activityTotals, type DailyActivity } from "./rules";

export type StaffActivity = DailyActivity & { actorId: string | null; actorName: string };

export function staffActivityTotals(days: string[], rows: StaffActivity[]) {
  const people = new Map<string, { id: string; name: string; retainedName: boolean; rows: DailyActivity[] }>();
  for (const row of rows) {
    if (!days.includes(row.day)) continue;
    const id = row.actorId ? `staff:${row.actorId}` : `retained:${row.actorName}`;
    const person = people.get(id) ?? { id, name: row.actorName, retainedName: row.actorId === null, rows: [] };
    person.name = row.actorName;
    const daily = person.rows.find(day => day.day === row.day);
    if (daily) { daily.enrolled += row.enrolled; daily.withdrawn += row.withdrawn; }
    else person.rows.push({ day: row.day, enrolled: row.enrolled, withdrawn: row.withdrawn });
    people.set(id, person);
  }
  return [...people.values()].map(({ rows, ...person }) => ({ ...person, ...activityTotals(days, rows) }))
    .sort((a, b) => b.enrolled + b.withdrawn - a.enrolled - a.withdrawn || a.name.localeCompare(b.name));
}

export type AttendanceOccurrence = {
  courseId: string; date: string; className: string; location: string | null;
  startMinutes: number; durationMinutes: number;
  instructorId: string | null; instructorName: string; scheduledName: string;
  started: boolean; cancelled: boolean; expected: number; marked: number;
  present: number; absent: number; late: number; savedBy: string[]; lastSavedAt: Date | null;
};

export const ATTENDANCE_REPORT_META = {
  saved: { label: "Saved", color: "green" },
  partial: { label: "Partial", color: "orange" },
  missing: { label: "Not taken", color: "red" },
  in_progress: { label: "In progress", color: "blue" },
  upcoming: { label: "Upcoming", color: "gray" },
  cancelled: { label: "Cancelled", color: "gray" },
  empty: { label: "No swimmers", color: "gray" },
} satisfies Record<string, StatusMeta>;
export type AttendanceReportStatus = keyof typeof ATTENDANCE_REPORT_META;

export function instructorAttendanceTotals(rows: AttendanceOccurrence[], now: Date) {
  const date = today(now), minutes = minutesNow(now);
  const classes = rows.map(row => {
    const ended = row.date < date || (row.date === date && row.startMinutes + row.durationMinutes <= minutes);
    const future = row.date > date || (row.date === date && row.startMinutes > minutes);
    const status: AttendanceReportStatus = row.cancelled ? "cancelled"
      : future ? "upcoming" : row.expected === 0 ? "empty"
      : row.marked >= row.expected ? "saved" : !ended ? "in_progress"
      : row.marked > 0 ? "partial" : "missing";
    return { ...row, lastSavedAt: row.lastSavedAt?.toISOString() ?? null, status,
      due: ended && !row.cancelled && row.expected > 0,
      instructorKey: row.instructorId ? `staff:${row.instructorId}` : `retained:${row.instructorName}` };
  });
  const groups = new Map<string, { id: string; name: string; due: number; saved: number; partial: number; missing: number; upcoming: number; cancelled: number; empty: number; inProgress: number }>();
  for (const row of classes) {
    const group = groups.get(row.instructorKey) ?? { id: row.instructorKey, name: row.instructorName, due: 0, saved: 0, partial: 0, missing: 0, upcoming: 0, cancelled: 0, empty: 0, inProgress: 0 };
    if (row.due) { group.due++; if (row.status === "saved") group.saved++; if (row.status === "partial") group.partial++; if (row.status === "missing") group.missing++; }
    if (row.status === "upcoming") group.upcoming++;
    if (row.status === "cancelled") group.cancelled++;
    if (row.status === "empty") group.empty++;
    if (!row.due && !["upcoming", "cancelled", "empty"].includes(row.status)) group.inProgress++;
    groups.set(row.instructorKey, group);
  }
  const instructors = [...groups.values()].sort((a, b) => b.missing + b.partial - a.missing - a.partial || a.name.localeCompare(b.name));
  const totals = instructors.reduce((sum, row) => ({ due: sum.due + row.due, saved: sum.saved + row.saved, partial: sum.partial + row.partial, missing: sum.missing + row.missing }), { due: 0, saved: 0, partial: 0, missing: 0 });
  return { classes, instructors, totals };
}
