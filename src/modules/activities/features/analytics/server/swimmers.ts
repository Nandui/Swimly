import { addDaysIso } from "@/lib/format";
import type { MarkRow, PlaceRow } from "@/modules/activities/features/analytics/server/insight-queries";
import { weeksBetween } from "@/modules/activities/features/analytics/server/period";

/** A swimmer who comes back within this many days of their last place ending
 *  (a move, a term break, a re-booking) has not left. */
export const RETURN_GRACE_DAYS = 14;

export type Span = {
  studentId: string; start: string; end: string | null; first: boolean;
  firstPlace: PlaceRow; lastPlace: PlaceRow; places: PlaceRow[];
};

/** Each swimmer's unbroken time with the swim school, across every site:
 *  overlapping or nearly back-to-back places merge into one span. */
export function swimmerSpans(places: PlaceRow[]): Map<string, Span[]> {
  const byStudent = new Map<string, PlaceRow[]>();
  for (const place of places) {
    if (place.endOn !== null && place.endOn <= place.startedOn) continue;
    byStudent.set(place.studentId, [...byStudent.get(place.studentId) ?? [], place]);
  }
  const out = new Map<string, Span[]>();
  for (const [studentId, rows] of byStudent) {
    rows.sort((a, b) => a.startedOn.localeCompare(b.startedOn) || a.id.localeCompare(b.id));
    const spans: Span[] = [];
    for (const place of rows) {
      const span = spans.at(-1);
      if (span && (span.end === null || place.startedOn <= addDaysIso(span.end, RETURN_GRACE_DAYS))) {
        span.places.push(place);
        if (span.end !== null && (place.endOn === null || place.endOn >= span.end)) {
          span.end = place.endOn;
          span.lastPlace = place;
        }
      } else {
        spans.push({ studentId, start: place.startedOn, end: place.endOn, first: spans.length === 0, firstPlace: place, lastPlace: place, places: [place] });
      }
    }
    out.set(studentId, spans);
  }
  return out;
}

const activeOn = (place: PlaceRow, date: string) => place.startedOn <= date && (place.endOn === null || place.endOn > date);

/** Swimmers (each once) and class places at these sites on a date. */
export function activeAt(places: PlaceRow[], date: string) {
  const swimmers = new Set<string>();
  let count = 0;
  for (const place of places) if (place.inScope && activeOn(place, date)) { swimmers.add(place.studentId); count++; }
  return { swimmers, places: count };
}

export type JoinEvent = { studentId: string; date: string; returning: boolean; place: PlaceRow };
export type LeaveEvent = { studentId: string; date: string; joined: string; weeks: number; place: PlaceRow; reason: string | null };

/** Joining and leaving the swim school, counted at the site of the first or
 *  last place. Leaving is dated the first day without a place; a scheduled
 *  last lesson still to come is "leaving soon", not a leaver. */
export function movements(spans: Map<string, Span[]>, today: string) {
  const joins: JoinEvent[] = [], leaves: LeaveEvent[] = [], leaving: LeaveEvent[] = [];
  for (const list of spans.values()) for (const span of list) {
    if (span.firstPlace.inScope) joins.push({ studentId: span.studentId, date: span.start, returning: !span.first, place: span.firstPlace });
    if (span.end === null || !span.lastPlace.inScope) continue;
    const event = {
      studentId: span.studentId, date: span.end, joined: span.start, weeks: weeksBetween(span.start, span.end), place: span.lastPlace,
      reason: span.lastPlace.leaveReason ?? (span.lastPlace.status === "COMPLETED" ? "finished-class" : null),
    };
    (span.end <= today ? leaves : leaving).push(event);
  }
  return { joins, leaves, leaving };
}

export const within = (date: string, from: string, to: string) => date >= from && date <= to;

/** Of the swimmers at these sites on `from`, the share still swimming with
 *  the school (at any site) on `to`. */
export function retention(places: PlaceRow[], from: string, to: string) {
  const start = activeAt(places, from).swimmers;
  if (start.size === 0) return { start: 0, stayed: 0, rate: null as number | null };
  const stillSwimming = new Set(places.filter(p => activeOn(p, to)).map(p => p.studentId));
  const stayed = [...start].filter(id => stillSwimming.has(id)).length;
  return { start: start.size, stayed, rate: stayed / start.size * 100 };
}

export const TENURE_BANDS = [
  { key: "lt3", label: "Under 3 months", maxWeeks: 13 },
  { key: "3to6", label: "3 to 6 months", maxWeeks: 26 },
  { key: "6to12", label: "6 to 12 months", maxWeeks: 52 },
  { key: "1to2", label: "1 to 2 years", maxWeeks: 104 },
  { key: "2plus", label: "2 years or more", maxWeeks: Infinity },
] as const;

export function tenureBand(weeks: number) {
  return TENURE_BANDS.find(band => weeks < band.maxWeeks)!;
}

export const AGE_BANDS = [
  { label: "Under 4", max: 4 }, { label: "4 to 5", max: 6 }, { label: "6 to 7", max: 8 }, { label: "8 to 9", max: 10 },
  { label: "10 to 12", max: 13 }, { label: "13 to 17", max: 18 }, { label: "18 and over", max: Infinity },
] as const;

export function ageOn(dateOfBirth: string, date: string) {
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = date.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

/** Current swimmers by age band, each once. */
export function ageProfile(places: PlaceRow[], date: string) {
  const seen = new Map<string, string | null>();
  for (const place of places) if (place.inScope && activeOn(place, date)) seen.set(place.studentId, place.dateOfBirth);
  const bands = AGE_BANDS.map(band => ({ label: band.label, count: 0 }));
  let unknown = 0;
  for (const dob of seen.values()) {
    if (!dob) { unknown++; continue; }
    const age = ageOn(dob, date);
    bands[AGE_BANDS.findIndex(band => age < band.max)].count++;
  }
  return { bands, unknown };
}

/** Why a swimmer looks likely to leave: three missed lessons in a row, or
 *  under 60% of their last eight marked lessons (at least four marked). */
export const RISK_RULES = { missedInARow: 3, recentLessons: 8, minMarked: 4, lowAttendance: 60 } as const;

export function attendanceRisk(marks: MarkRow[]) {
  const latest = marks.slice(0, RISK_RULES.recentLessons);
  let missedInARow = 0;
  for (const mark of latest) { if (mark.status !== "ABSENT") break; missedInARow++; }
  const attended = latest.filter(m => m.status !== "ABSENT").length;
  const rate = latest.length ? attended / latest.length * 100 : null;
  const lastAttended = latest.find(m => m.status !== "ABSENT")?.date ?? null;
  const reasons: string[] = [];
  if (missedInARow >= RISK_RULES.missedInARow) reasons.push(`Missed ${missedInARow} in a row`);
  else if (rate !== null && latest.length >= RISK_RULES.minMarked && rate < RISK_RULES.lowAttendance) reasons.push(`Came to ${attended} of last ${latest.length}`);
  return { missedInARow, rate, attended, marked: latest.length, lastAttended, reasons };
}

/** Who last taught a swimmer they came to, from their newest marks. */
export function lastTeacher(marks: MarkRow[]) {
  const mark = marks.find(m => m.status !== "ABSENT" && m.teacherName);
  return mark ? { key: teacherKey(mark.teacherId, mark.teacherName!), name: mark.teacherName! } : null;
}

export function teacherKey(id: string | null, name: string) {
  return id ? `staff:${id}` : `name:${name}`;
}

/** Joiners, leavers and swimmers month by month (`months` are first days). */
export function monthlyMovement(places: PlaceRow[], joins: JoinEvent[], leaves: LeaveEvent[], months: string[], today: string) {
  return months.map(month => {
    const [year, number] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 10);
    const last = addDaysIso(next, -1) < today ? addDaysIso(next, -1) : today;
    const startCount = activeAt(places, addDaysIso(month, -1)).swimmers.size;
    const left = leaves.filter(e => within(e.date, month, last)).length;
    return {
      month, swimmers: activeAt(places, last).swimmers.size,
      joined: joins.filter(e => within(e.date, month, last)).length,
      left, dropOff: startCount ? left / startCount * 100 : null,
    };
  });
}
