import { isPaidBreak, type RotaWarning } from "@/lib/rota/constants";

/** One day of the plan as a timeline (owner request, October 2026: "the
 *  timeline view and adding people, assigning their activity during a shift
 *  and all the breaks"): a row per person with their shifts, and inside each
 *  shift what they do when, breaks included; the Swim school classes they
 *  teach on the same row; and, across the top, each activity's cover through
 *  the day with its gaps (no 25m pool lifeguard 13:00–13:30, say). Pure and
 *  tested; the page loads the day and draws it. */

export type TimelineShift = {
  id: string;
  kind: string;
  startMinutes: number;
  endMinutes: number;
  role: string;
  userId: string | null;
  rotaPersonId: string | null;
  importId: string | null;
  bookingId?: string | null;
  bookingNeed?: { role: string } | null;
  user: { name: string } | null;
  rotaPerson: { name: string } | null;
  department?: { name: string } | null;
  warnings: RotaWarning[];
  segments: { id: string; startMinutes: number; endMinutes: number; kind: string; label: string }[];
};
export type TimelineClass = { userId: string | null; startMinutes: number; endMinutes: number; label: string; href?: string };

export type Segment = { start: number; end: number; kind: "activity" | "break" | "teaching"; label: string; href?: string };
export type RowShift = {
  id: string; start: number; end: number; role: string;
  /** A place on a booking: the role it is for. */
  part: string | null;
  segments: Segment[];
  absent: boolean; warnings: RotaWarning[]; editable: boolean;
};
export type PersonRow = { key: string; name: string | null; userId: string | null; roles: string; minutes: number; breaks: number; shifts: RowShift[]; teaching: Segment[] };
export type Cover = {
  /** The planned activity, when the day has one by this name; null for one only seen inside shifts. */
  activity: { id: string; start: number; end: number; people: number; requiredTypeId: string | null; requiredType: string | null; note: string } | null;
  label: string;
  spans: { start: number; end: number; who: string }[];
  /** When fewer than the people it needs are on it (within its planned times), or between people when it has no plan. */
  gaps: { start: number; end: number; short: number }[];
};
export type PlannedActivity = { id: string; label: string; startMinutes: number; endMinutes: number; people: number; requiredTypeId: string | null; requiredType: { name: string } | null; note: string };

/** When fewer than `people` are on it between `start` and `end`, and by how many. */
export function coverGaps(window: { start: number; end: number; people: number }, spans: readonly { start: number; end: number }[]) {
  const cuts = [...new Set([window.start, window.end, ...spans.flatMap((s) => [s.start, s.end])])].filter((t) => t >= window.start && t <= window.end).sort((a, b) => a - b);
  const gaps: Cover["gaps"] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [a, b] = [cuts[i], cuts[i + 1]];
    const short = window.people - spans.filter((s) => s.start <= a && s.end >= b).length;
    if (short <= 0) continue;
    const last = gaps.at(-1);
    if (last && last.end === a && last.short === short) last.end = b; else gaps.push({ start: a, end: b, short });
  }
  return gaps;
}

/** Someone on the day who could take on an activity: their shift there, what
 *  they are already doing (activities, breaks, teaching) and what they hold. */
export type Candidate = { shiftId: string; name: string; start: number; end: number; busy: { start: number; end: number; label: string }[]; absent: boolean; types: string[] };
export type Fit = { candidate: Candidate; status: "free" | "part" | "busy"; from: number; to: number; reason: string; qualified: boolean };

/** Who can cover `start`–`end`: free for all of it, free for part of it (the
 *  longest free stretch), or busy (why). Qualified ones first. Pure. */
export function fitsFor(span: { start: number; end: number; requiredTypeId: string | null }, candidates: readonly Candidate[]): Fit[] {
  const order = { free: 0, part: 1, busy: 2 };
  return candidates.map((c): Fit => {
    const qualified = !span.requiredTypeId || c.types.includes(span.requiredTypeId);
    const from = Math.max(span.start, c.start), to = Math.min(span.end, c.end);
    if (c.absent) return { candidate: c, status: "busy", from, to, reason: "Off", qualified };
    if (to <= from) return { candidate: c, status: "busy", from, to, reason: "Not on shift then", qualified };
    const clashes = c.busy.filter((b) => b.start < to && from < b.end).sort((a, b) => a.start - b.start);
    // The longest free stretch inside their part of the span.
    let best = { from: 0, to: 0 }, at = from;
    for (const b of [...clashes, { start: to, end: to, label: "" }]) {
      if (b.start > at && b.start - at > best.to - best.from) best = { from: at, to: Math.min(b.start, to) };
      at = Math.max(at, b.end);
    }
    if (best.to <= best.from) return { candidate: c, status: "busy", from, to, reason: clashes.map((b) => `${b.label} ${clockOf(b.start)}–${clockOf(b.end)}`).join(", "), qualified };
    const whole = best.from === span.start && best.to === span.end;
    return { candidate: c, status: whole ? "free" : "part", from: best.from, to: best.to, reason: whole ? "" : `Free ${clockOf(best.from)}–${clockOf(best.to)}`, qualified };
  }).sort((a, b) => order[a.status] - order[b.status] || Number(!a.qualified) - Number(!b.qualified) || (b.to - b.from) - (a.to - a.from) || a.candidate.name.localeCompare(b.candidate.name));
}
const clockOf = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Whole hours around everything on the day, at least 06:00 to 22:00. */
export function dayRange(times: readonly { startMinutes: number; endMinutes: number }[]) {
  return {
    from: Math.min(360, ...times.map((t) => Math.floor(t.startMinutes / 60) * 60)),
    to: Math.max(1320, ...times.map((t) => Math.ceil(t.endMinutes / 60) * 60)),
  };
}

export function buildTimeline(shifts: readonly TimelineShift[], classes: readonly TimelineClass[] = [], planned: readonly PlannedActivity[] = []) {
  const people = new Map<string, { key: string; name: string | null; userId: string | null; list: TimelineShift[] }>();
  for (const s of shifts) {
    if (s.kind !== "shift") continue;
    const key = s.rotaPersonId ? `p:${s.rotaPersonId}` : s.userId ? `u:${s.userId}` : `open:${s.id}`;
    const p = people.get(key) ?? { key, name: s.user?.name ?? s.rotaPerson?.name ?? null, userId: s.userId, list: [] };
    p.list.push(s);
    people.set(key, p);
  }
  const rows: PersonRow[] = [...people.values()].map((p) => {
    const list = [...p.list].sort((a, b) => a.startMinutes - b.startMinutes);
    // Unpaid breaks come off the hours (and are the break shown); paid ones stay in them (house rule).
    const breaks = list.flatMap((s) => s.segments.filter((g) => g.kind === "break" && !isPaidBreak(g))).reduce((m, g) => m + g.endMinutes - g.startMinutes, 0);
    // A booking's place inside the person's own shift is time on that shift, not more hours.
    const own = list.filter((s) => !s.bookingId || !list.some((o) => o !== s && !o.bookingId && o.startMinutes <= s.startMinutes && o.endMinutes >= s.endMinutes));
    return {
      key: p.key, name: p.name, userId: p.userId,
      roles: [...new Set(list.map((s) => s.bookingNeed?.role ?? s.role))].join(", "),
      minutes: own.reduce((m, s) => m + s.endMinutes - s.startMinutes, 0) - breaks, breaks,
      shifts: list.map((s) => ({
        id: s.id, start: s.startMinutes, end: s.endMinutes, role: s.role, part: s.bookingNeed?.role ?? null,
        segments: s.segments.map((g) => ({ start: g.startMinutes, end: g.endMinutes, kind: g.kind === "break" ? "break" as const : "activity" as const, label: g.label })),
        absent: s.warnings.includes("absent"), warnings: s.warnings.filter((w) => w !== "absent" && w !== "open"), editable: !s.importId,
      })),
      teaching: p.userId ? classes.filter((c) => c.userId === p.userId).map((c) => ({ start: c.startMinutes, end: c.endMinutes, kind: "teaching" as const, label: c.label, href: c.href })) : [],
    };
  }).sort((a, b) => Number(!a.name) - Number(!b.name) || a.shifts[0].start - b.shifts[0].start || (a.name ?? "").localeCompare(b.name ?? ""));

  // Each activity's cover: who does it when, and when fewer are on it than it needs.
  const byLabel = new Map<string, Cover["spans"]>();
  for (const r of rows) for (const s of r.shifts) {
    if (s.absent || !r.name) continue;
    for (const g of s.segments) if (g.kind === "activity") {
      const key = g.label.trim().toLowerCase();
      byLabel.set(key, [...(byLabel.get(key) ?? []), { start: g.start, end: g.end, who: r.name }]);
    }
  }
  const spansOf = (label: string) => [...(byLabel.get(label.trim().toLowerCase()) ?? [])].sort((a, b) => a.start - b.start);
  const cover: Cover[] = [...planned].sort((a, b) => a.startMinutes - b.startMinutes || a.label.localeCompare(b.label)).map((p) => {
    const spans = spansOf(p.label);
    return {
      activity: { id: p.id, start: p.startMinutes, end: p.endMinutes, people: p.people, requiredTypeId: p.requiredTypeId, requiredType: p.requiredType?.name ?? null, note: p.note },
      label: p.label.trim(), spans, gaps: coverGaps({ start: p.startMinutes, end: p.endMinutes, people: p.people }, spans),
    };
  });
  // Activities only seen inside shifts: their gaps are the time between people.
  const plannedNames = new Set(planned.map((p) => p.label.trim().toLowerCase()));
  for (const [key, list] of byLabel) {
    if (plannedNames.has(key)) continue;
    const spans = [...list].sort((a, b) => a.start - b.start);
    const label = rows.flatMap((r) => r.shifts.flatMap((s) => s.segments)).find((g) => g.label.trim().toLowerCase() === key)!.label.trim();
    cover.push({ activity: null, label, spans, gaps: coverGaps({ start: spans[0].start, end: Math.max(...spans.map((x) => x.end)), people: 1 }, spans) });
  }
  return { rows, cover };
}
export type DayTimeline = ReturnType<typeof buildTimeline>;
