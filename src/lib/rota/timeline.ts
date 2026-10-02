import type { RotaWarning } from "@/lib/rota/constants";

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
export type Cover = { label: string; spans: { start: number; end: number; who: string }[]; gaps: { start: number; end: number }[] };

/** Whole hours around everything on the day, at least 06:00 to 22:00. */
export function dayRange(times: readonly { startMinutes: number; endMinutes: number }[]) {
  return {
    from: Math.min(360, ...times.map((t) => Math.floor(t.startMinutes / 60) * 60)),
    to: Math.max(1320, ...times.map((t) => Math.ceil(t.endMinutes / 60) * 60)),
  };
}

export function buildTimeline(shifts: readonly TimelineShift[], classes: readonly TimelineClass[] = []) {
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
    const breaks = list.flatMap((s) => s.segments.filter((g) => g.kind === "break")).reduce((m, g) => m + g.endMinutes - g.startMinutes, 0);
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

  // Each activity's cover: who does it when, and the gaps between its first start and last end.
  const byLabel = new Map<string, Cover["spans"]>();
  for (const r of rows) for (const s of r.shifts) {
    if (s.absent || !r.name) continue;
    for (const g of s.segments) if (g.kind === "activity") {
      const key = g.label.trim();
      byLabel.set(key, [...(byLabel.get(key) ?? []), { start: g.start, end: g.end, who: r.name }]);
    }
  }
  const cover: Cover[] = [...byLabel].map(([label, spans]) => {
    const sorted = [...spans].sort((a, b) => a.start - b.start);
    const gaps: Cover["gaps"] = [];
    let reach = sorted[0].end;
    for (const s of sorted.slice(1)) {
      if (s.start > reach) gaps.push({ start: reach, end: s.start });
      reach = Math.max(reach, s.end);
    }
    return { label, spans: sorted, gaps };
  }).sort((a, b) => a.label.localeCompare(b.label));
  return { rows, cover };
}
export type DayTimeline = ReturnType<typeof buildTimeline>;
