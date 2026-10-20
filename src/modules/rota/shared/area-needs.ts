import { subtract, type Span } from "@/modules/rota/shared/cover";
import type { AreaMinimum } from "@/modules/rota/shared/staffing";
import { hhmm, hoursOn, lineLabel, type AreaTogether, type WeekHour } from "@/lib/setup/area-staffing";

export { lineLabel };

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
  /** What it is called: the role it asks for ("Lifeguard"), or the qualification no role needs;
   *  null for anyone. */
  label: string | null;
  startMinutes: number; endMinutes: number; places: number;
  /** Places not needed for a stretch: a covered area while the other is open, or the other area's
   *  places beyond its joint number (or beyond its own number outside the joint time). */
  off: OffSpan[];
  /** "Covered from Main pool 09:00–21:00", "Covers 18 m pool 09:00–21:00: 2 in all". */
  together: string | null;
};

/** The activity an area's need is: `area:<area>:<type>`, the need that and `:<date>`. */
export const areaTypeId = (areaId: string, typeId: string | null) => `area:${areaId}:${typeId ?? "*"}`;

const span = (s: Span) => `${hhmm(s.start)}–${hhmm(s.end)}`;
const join = (a: string | null, b: string) => (a ? `${a}; ${b}` : b);

export function areaNeedsOn(areas: readonly NeedArea[], date: string): AreaNeed[] {
  const byId = new Map(areas.map((a) => [a.id, a]));
  const hours = new Map(areas.map((a) => [a.id, hoursOn({ openFrom: a.openFrom ?? null, openUntil: a.openUntil ?? null, weekHours: a.weekHours ?? [] }, date)]));
  const needs = new Map<string, AreaNeed & { own: number }>();
  for (const a of areas) {
    const h = hours.get(a.id);
    if (!h) continue;
    for (const m of a.minimums ?? []) {
      const key = areaTypeId(a.id, m.typeId);
      const had = needs.get(key);
      // Two roles that the same people can fill share one need.
      const label = lineLabel(a.minimums, m.typeId);
      if (had) { had.places += m.count; had.own += m.count; had.label = lineLabel(a.minimums, m.typeId); continue; }
      needs.set(key, { id: `${key}:${date}`, typeId: key, areaId: a.id, areaName: a.name, qualificationTypeId: m.typeId, typeName: m.typeName, label, startMinutes: h.start, endMinutes: h.end,
        places: m.count, own: m.count, off: [], together: null });
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
      const line = (a.minimums ?? []).find((m) => m.typeId === r.typeId);
      const typeName = covered?.typeName ?? line?.typeName ?? null;
      const label = covered?.label ?? (line ? lineLabel(a.minimums, r.typeId) : null);
      const key = areaTypeId(b.id, r.typeId);
      let cover = needs.get(key);
      if (!cover) {
        // The other area needs none of this type of its own: only in the joint time.
        cover = { id: `${key}:${date}`, typeId: key, areaId: b.id, areaName: b.name, qualificationTypeId: r.typeId, typeName, label, startMinutes: both.start, endMinutes: both.end,
          places: 0, own: 0, off: [], together: null };
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
  return [...needs.values()].filter((n) => n.places > 0).map(({ own: _own, ...n }) => { void _own; return n; });
}

/** How many of each type an area needs, stretch by stretch, from its needs and what is off: what
 *  breaks are placed against. */
export function areaMinimumsOver(needs: readonly AreaNeed[]): (Span & { minimums: AreaMinimum[] })[] {
  const cuts = [...new Set(needs.flatMap((n) => [n.startMinutes, n.endMinutes, ...n.off.flatMap((o) => [o.start, o.end])]))].sort((a, b) => a - b);
  const out: (Span & { minimums: AreaMinimum[] })[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i], end = cuts[i + 1];
    const minimums = needs.filter((n) => n.startMinutes <= start && n.endMinutes >= end).map((n) => ({
      count: n.places - new Set(n.off.filter((o) => o.start <= start && o.end >= end).map((o) => o.place)).size, typeId: n.qualificationTypeId, typeName: n.typeName, roleName: n.label }))
      .filter((m) => m.count > 0);
    if (minimums.length) out.push({ start, end, minimums });
  }
  return out;
}

/** A stretch less the times its place is off. */
export const lessOff = (s: Span, place: number | null, off: readonly OffSpan[] | undefined) => (off?.length && place ? subtract(s, off.filter((o) => o.place === place)) : [s]);
