import { CircleDashed, CopyX, ShieldAlert, TriangleAlert, UserX } from "lucide-react";
import type { StatusMeta } from "@/lib/status";
import type { RotaWarning } from "@/lib/rota/constants";
import { buildTimeline, type PlannedActivity, type TimelineShift } from "@/lib/rota/timeline";

/** The week planner's day (owner decision, 5 October 2026): what needs people against who is on
 *  shift. A need is anything a supervisor still has to sort out on that day: a booking place or
 *  shift with nobody on it, someone on it who is off, someone without the qualification it needs,
 *  someone double-booked, or fixed cover with nobody on it. Pure and tested; the page builds the
 *  Needs you list and the day tabs' counts from it. */

/** Each kind of need: its words, tone and icon, and whether it is a problem with someone already
 *  on it (danger) or a place still to fill (short). Colour is never the only signal. */
export const ROTA_NEED_META = {
  unfilled: { label: "Nobody on it", color: "orange", icon: CircleDashed, severity: "short" },
  cover: { label: "Gap in cover", color: "orange", icon: TriangleAlert, severity: "short" },
  off: { label: "Off, needs cover", color: "red", icon: UserX, severity: "danger" },
  qualification: { label: "Not qualified", color: "red", icon: ShieldAlert, severity: "danger" },
  double: { label: "Double-booked", color: "red", icon: CopyX, severity: "danger" },
} as const satisfies Record<string, StatusMeta & { severity: "short" | "danger" }>;
export type RotaNeedKind = keyof typeof ROTA_NEED_META;

export type PlannerShift = {
  id: string;
  startMinutes: number;
  endMinutes: number;
  role: string;
  bookingId: string | null;
  bookingNeed?: { role: string } | null;
  userId: string | null;
  rotaPersonId: string | null;
  user?: { name: string } | null;
  rotaPerson?: { name: string } | null;
  warnings: readonly RotaWarning[];
};
/** A stretch of fixed cover (an activity) with fewer people on it than it needs. */
export type PlannerGap = { label: string; start: number; end: number; short: number; activityId: string | null };

export type RotaNeed = {
  key: string;
  kind: RotaNeedKind;
  start: number;
  end: number;
  /** What it is: "Swim teacher, St Joseph's" or "25m pool lifeguard". */
  what: string;
  /** Who is on it, when someone is. */
  who: string | null;
  /** How many people it is short. */
  short: number;
  /** The shift or booking place to change, when it is one. */
  shiftId: string | null;
  activityId: string | null;
};

const nameOf = (s: PlannerShift) => s.user?.name ?? s.rotaPerson?.name ?? null;
/** A booking place says its role and what it is for; a shift says its duty. */
export const placeLabel = (s: Pick<PlannerShift, "role" | "bookingNeed">) => (s.bookingNeed?.role ? `${s.bookingNeed.role}, ${s.role.replace(/^[^:]+:\s*/, "")}` : s.role);

/** Everything still to sort out on a day, in time order (the most serious first at the same time). */
export function dayNeeds(shifts: readonly PlannerShift[], gaps: readonly PlannerGap[]): RotaNeed[] {
  const needs: RotaNeed[] = [];
  for (const s of shifts) {
    const who = nameOf(s);
    const base = { start: s.startMinutes, end: s.endMinutes, what: placeLabel(s), who, short: 1, shiftId: s.id, activityId: null };
    if (!who) { needs.push({ ...base, key: `${s.id}:unfilled`, kind: "unfilled" }); continue; }
    if (s.warnings.includes("absent")) needs.push({ ...base, key: `${s.id}:off`, kind: "off" });
    else if (s.warnings.includes("missing") || s.warnings.includes("expired")) needs.push({ ...base, key: `${s.id}:qualification`, kind: "qualification" });
    if (s.warnings.includes("overlap")) needs.push({ ...base, key: `${s.id}:double`, kind: "double", short: 0 });
  }
  for (const [i, g] of gaps.entries()) {
    needs.push({ key: `gap:${g.activityId ?? g.label}:${i}`, kind: "cover", start: g.start, end: g.end, what: g.label, who: null, short: g.short, shiftId: null, activityId: g.activityId });
  }
  const rank = (n: RotaNeed) => (ROTA_NEED_META[n.kind].severity === "danger" ? 0 : 1);
  return needs.sort((a, b) => a.start - b.start || rank(a) - rank(b) || a.what.localeCompare(b.what));
}

/** One day's needs for a department (every department when none is given): its own shifts and
 *  booking places, and the gaps in its fixed cover. Cover counts everyone on shift, whichever
 *  department they are in, since anyone on the plan can stand in. */
export function dayNeedsFor<S extends TimelineShift & PlannerShift & { departmentId: string | null }, A extends PlannedActivity & { departmentId: string | null }>(
  shifts: readonly S[], planned: readonly A[], departmentId: string | null,
) {
  const own = (s: { departmentId: string | null }) => !departmentId || s.departmentId === departmentId;
  // Cover the whole site shares (no department) counts for every department.
  const cover = buildTimeline(shifts, [], planned.filter((a) => !a.departmentId || own(a))).cover.filter((c) => c.activity || !departmentId);
  const gaps = cover.flatMap((c) => c.gaps.map((g) => ({ label: c.label, start: g.start, end: g.end, short: g.short, activityId: c.activity?.id ?? null })));
  return { needs: dayNeeds(shifts.filter((s) => s.kind === "shift" && own(s)), gaps), cover };
}
