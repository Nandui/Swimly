import { subtract, type Span } from "@/modules/rota/shared/cover";
import type { AreaMinimum } from "@/modules/rota/shared/staffing";
import { hhmm, hoursOn, type AreaTogether, type WeekHour } from "@/lib/setup/area-staffing";

/** Each area's own needs on a date (Admin, Areas): one per type of staff while it is open, and
 *  areas covered from another while both are open (owner request, 16 October 2026: the main hall
 *  and the 18 m pool are open together, "we might just need one lifeguard sitting between both
 *  areas by the door"). Then the covered area's staff of that type are not needed and the other
 *  area needs the joint number in all. Pure: the Plan and the actions both work from it
 *  (area-needs.test.ts). */

export type NeedArea = { id: string; name: string; openFrom?: number | null; openUntil?: number | null; weekHours?: readonly WeekHour[]; minimums?: readonly AreaMinimum[]; together?: readonly AreaTogether[] };
/** A place of a need that is not needed for a stretch. */
export type OffSpan = Span & { place: number };
export type AreaNeed = {
  id: string; typeId: string; areaId: string; areaName: string; qualificationTypeId: string | null; typeName: string | null;
  startMinutes: number; endMinutes: number; places: number;
  /** Places not needed for a stretch: a covered area while the other is open, or the other area's
   *  places beyond its joint number (or beyond its own number outside the joint time). */
  off: OffSpan[];
  /** "Covered from Main pool 09:00–21:00", "Covers 18 m pool 09:00–21:00: 2 in all". */
  together: string | null;
  /** The activity people must be on to count (owner, 21 October 2026: Reception needs at least
   *  one person on Serving customers), for a need from the area's activity lines; else null. */
  activityTypeId: string | null;
  activityName: string | null;
};

/** The activity an area's need is: `area:<area>:<type>`, the need that and `:<date>`. */
export const areaTypeId = (areaId: string, typeId: string | null) => `area:${areaId}:${typeId ?? "*"}`;
/** The `<type>` of an area's need for its people on an activity: `act-<activity>`. */
export const ACTIVITY_NEED = "act-";
export const areaActivityTypeId = (areaId: string, activityTypeId: string) => areaTypeId(areaId, `${ACTIVITY_NEED}${activityTypeId}`);
/** People on an activity in an area for a stretch, each span one person: what an activity line counts. */
export type OnActivity = (areaId: string, activityTypeId: string) => readonly Span[];

const span = (s: Span) => `${hhmm(s.start)}–${hhmm(s.end)}`;
const join = (a: string | null, b: string) => (a ? `${a}; ${b}` : b);

export function areaNeedsOn(areas: readonly NeedArea[], date: string, onActivity?: OnActivity): AreaNeed[] {
  const byId = new Map(areas.map((a) => [a.id, a]));
  const hours = new Map(areas.map((a) => [a.id, hoursOn({ openFrom: a.openFrom ?? null, openUntil: a.openUntil ?? null, weekHours: a.weekHours ?? [] }, date)]));
  const needs = new Map<string, AreaNeed & { own: number }>();
  for (const a of areas) {
    const h = hours.get(a.id);
    if (!h) continue;
    for (const m of a.minimums ?? []) {
      if (m.activityTypeId) continue;
      const key = areaTypeId(a.id, m.typeId);
      const had = needs.get(key);
      if (had) { had.places += m.count; had.own += m.count; continue; }
      needs.set(key, { id: `${key}:${date}`, typeId: key, areaId: a.id, areaName: a.name, qualificationTypeId: m.typeId, typeName: m.typeName, startMinutes: h.start, endMinutes: h.end,
        places: m.count, own: m.count, off: [], together: null, activityTypeId: null, activityName: null });
    }
  }
  for (const a of areas) {
    const ha = hours.get(a.id);
    for (const r of a.together ?? []) {
      const b = byId.get(r.withAreaId);
      const hb = b ? hours.get(b.id) : null;
      if (!ha || !b || !hb || b.id === a.id) continue;
      const both = { start: Math.max(ha.start, hb.start), end: Math.min(ha.end, hb.end) };
      if (both.end <= both.start) continue;
      const covered = needs.get(areaTypeId(a.id, r.typeId));
      if (covered) {
        for (let place = 1; place <= covered.places; place++) covered.off.push({ place, ...both });
        covered.together = join(covered.together, `Covered from ${b.name} ${span(both)}`);
      }
      const typeName = covered?.typeName ?? (a.minimums ?? []).find((m) => !m.activityTypeId && m.typeId === r.typeId)?.typeName ?? null;
      const key = areaTypeId(b.id, r.typeId);
      let cover = needs.get(key);
      if (!cover) {
        // The other area needs none of this type of its own: only in the joint time.
        cover = { id: `${key}:${date}`, typeId: key, areaId: b.id, areaName: b.name, qualificationTypeId: r.typeId, typeName, startMinutes: both.start, endMinutes: both.end,
          places: 0, own: 0, off: [], together: null, activityTypeId: null, activityName: null };
        needs.set(key, cover);
      }
      const own = cover.own;
      if (r.count > cover.places) {
        // Places beyond its own number are only needed while both are open.
        const outside = subtract({ start: cover.startMinutes, end: cover.endMinutes }, [both]);
        for (let place = cover.places + 1; place <= r.count; place++) for (const s of outside) cover.off.push({ place, ...s });
        cover.places = r.count;
      }
      for (let place = r.count + 1; place <= Math.max(own, r.count); place++) cover.off.push({ place, ...both });
      cover.together = join(cover.together, `Covers ${a.name} ${span(both)}: ${r.count} in all`);
    }
  }
  const own = [...needs.values()].filter((n) => n.places > 0).map(({ own: _own, ...n }) => { void _own; return n; });
  return [...own, ...areas.flatMap((a) => activityNeedsOf(a, hours.get(a.id) ?? null, date, onActivity))];
}

/** An area's activity lines on a date (owner, 21 October 2026: "areas should require the presence
 *  of a certain number of staff on activities related to that area"): one need for each activity,
 *  its places the most any of its lines asks for, off where fewer are asked for or nobody is.
 *  A line's own times keep inside the hours it is open; without its own times it is whenever it
 *  is open. Lines are each "at least", so two at once ask for the larger number. People already
 *  on the activity there (`onActivity`) take places off too. */
function activityNeedsOf(a: NeedArea, open: Span | null, date: string, onActivity?: OnActivity): AreaNeed[] {
  const hasHours = a.openFrom != null || (a.weekHours ?? []).length > 0;
  const byActivity = new Map<string, { name: string | null; lines: (Span & { count: number })[] }>();
  for (const m of a.minimums ?? []) {
    if (!m.activityTypeId || m.count < 1) continue;
    const own = m.from != null && m.until != null && m.until > m.from ? { start: m.from, end: m.until } : null;
    let window: Span | null = own ?? open;
    if (own && hasHours) window = open ? { start: Math.max(own.start, open.start), end: Math.min(own.end, open.end) } : null;
    if (!window || window.end <= window.start) continue;
    const entry = byActivity.get(m.activityTypeId) ?? { name: m.activityName ?? null, lines: [] };
    entry.lines.push({ ...window, count: m.count });
    byActivity.set(m.activityTypeId, entry);
  }
  return [...byActivity.entries()].map(([activityTypeId, { name, lines }]) => {
    const present = onActivity?.(a.id, activityTypeId) ?? [];
    const start = Math.min(...lines.map((l) => l.start)), end = Math.max(...lines.map((l) => l.end));
    const places = Math.max(...lines.map((l) => l.count));
    const cuts = [...new Set([start, end, ...lines.flatMap((l) => [l.start, l.end]), ...present.flatMap((p) => [p.start, p.end])])].filter((t) => t >= start && t <= end).sort((x, y) => x - y);
    const off: OffSpan[] = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const s = { start: cuts[i], end: cuts[i + 1] };
      const asked = Math.max(0, ...lines.filter((l) => l.start <= s.start && l.end >= s.end).map((l) => l.count));
      const want = Math.max(0, asked - present.filter((p) => p.start <= s.start && p.end >= s.end).length);
      for (let place = want + 1; place <= places; place++) {
        const last = off.findLast((o) => o.place === place);
        if (last && last.end === s.start) last.end = s.end; else off.push({ place, ...s });
      }
    }
    const key = areaActivityTypeId(a.id, activityTypeId);
    return { id: `${key}:${date}`, typeId: key, areaId: a.id, areaName: a.name, qualificationTypeId: null, typeName: null, startMinutes: start, endMinutes: end, places, off,
      together: null, activityTypeId, activityName: name };
  });
}

/** How many of each type an area needs, stretch by stretch, from its needs and what is off: what
 *  breaks are placed against. */
export function areaMinimumsOver(needs: readonly AreaNeed[]): (Span & { minimums: AreaMinimum[] })[] {
  const cuts = [...new Set(needs.flatMap((n) => [n.startMinutes, n.endMinutes, ...n.off.flatMap((o) => [o.start, o.end])]))].sort((a, b) => a - b);
  const out: (Span & { minimums: AreaMinimum[] })[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i], end = cuts[i + 1];
    const minimums = needs.filter((n) => n.startMinutes <= start && n.endMinutes >= end).map((n) => ({
      count: n.places - new Set(n.off.filter((o) => o.start <= start && o.end >= end).map((o) => o.place)).size, typeId: n.qualificationTypeId, typeName: n.typeName }))
      .filter((m) => m.count > 0);
    if (minimums.length) out.push({ start, end, minimums });
  }
  return out;
}

/** A stretch less the times its place is off. */
export const lessOff = (s: Span, place: number | null, off: readonly OffSpan[] | undefined) => (off?.length && place ? subtract(s, off.filter((o) => o.place === place)) : [s]);
