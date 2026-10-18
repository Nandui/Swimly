import { intoLanes, mergeTouching, needGaps } from "@/modules/rota/shared/cover";
import { qualification, type Held } from "@/modules/rota/shared/fit";
import { subtract, type Span } from "@/modules/rota/shared/cover";
import { dayShift, type DayShift, type PinnedBreak, type WorkItem } from "@/modules/rota/shared/shifts";
import type { YoungBand } from "@/modules/rota/shared/constants";
import { lanesInPlace } from "@/modules/rota/shared/lanes";
import { shortWeight, without, type AreaMinimum, type Presence } from "@/modules/rota/shared/staffing";
import type { AreaTogether, WeekHour } from "@/lib/setup/area-staffing";
import { areaMinimumsOver, areaNeedsOn, areaTypeId, lessOff, type OffSpan } from "@/modules/rota/shared/area-needs";

/** One day at one site, as every Rota screen draws it (Plan, Today, Turnfin Me): its **areas**
 *  (the site's list in Admin, Areas: Main pool, Learner pool, Front desk; owner decisions, 6 and 7
 *  October 2026), each with the activities in it, each activity's places a lane of people and
 *  gaps; the swim classes as Teaching in the area their location names ("Learner pool, lane 3");
 *  and each person's shift worked out from what they are on. Pure: the loaders read the rows and
 *  this lays them out (day.test.ts). */

export type DayType = { id: string; name: string; icon: string; departmentId: string; requiredTypeId: string | null; requiredName: string | null; fromClasses: boolean };
export type DayNeed = { id: string; typeId: string; place: string; startMinutes: number; endMinutes: number; places: number; note: string; repeatTitle: string | null;
  /** The area's lanes it takes; none (or left out) for the whole area. */
  lanes?: number[];
  /** An area's need: places not needed for a stretch (covered from another area). */
  off?: OffSpan[];
  /** An area's need: "Covered from Main pool 09:00–21:00", "Covers 18 m pool …: 2 in all". */
  together?: string | null };
export type DayAssignment = { id: string; needId: string; place: number; userId: string; startMinutes: number; endMinutes: number };
/** Something another module has on at the site (an Academy or short course session), from
 *  the commitments seam: drawn in its area for whoever is on it, planned in that module. */
export type DayBooked = { ref: string; userId: string | null; startMinutes: number; endMinutes: number; title: string; place: string; href: string | null; module?: string };
/** Booked things sit on every department's plan: the time and the area are taken. */
export const ANY_DEPARTMENT = "*";
/** The swim classes (owner decisions, 16 October 2026: the swim school's classes fill the Plan by
 *  themselves, and "no booking option takes the swim school anymore"): on every department's
 *  plan, as booked things are, waiting for a teacher. */
const SWIM_CLASSES: DayType = { id: "swim-classes", name: "Swim classes", icon: "teaching", departmentId: ANY_DEPARTMENT, requiredTypeId: null, requiredName: null, fromClasses: true };
/** Someone on a place of an area's own need (owner request, 16 October 2026: "in addition to
 *  bookings and activities, each area has their needs"): the need is the area's hours and staff
 *  in Admin, Areas, one per type of staff (`typeId`, the qualification, null for anyone). */
export type DayAreaAssignment = { id: string; areaId: string; typeId: string | null; place: number; userId: string; startMinutes: number; endMinutes: number };
/** An area's need is an activity on the day like any other, with ids that say whose it is: the
 *  activity `area:<area>:<type>`, the need that and `:<date>`, a person on it `area:<row>`. */
export { areaTypeId };
export const isAreaNeed = (id: string | null | undefined) => !!id && id.startsWith("area:");
/** The area, type of staff and date an area need's id names; null for any other need. */
export function areaNeedOf(needId: string): { areaId: string; typeId: string | null; date: string } | null {
  const [prefix, areaId, type, date] = needId.split(":");
  return prefix === "area" && areaId && type && date ? { areaId, typeId: type === "*" ? null : type, date } : null;
}
/** The stored row behind a person on an area need (`area:<row>`), or null. */
export const areaAssignmentRow = (id: string) => (id.startsWith("area:") ? id.slice(5) : null);
/** "Pool Lifeguard on duty", "Staff on duty". */
export const areaNeedName = (typeName: string | null) => (typeName ? `${typeName} on duty` : "Staff on duty");

/** A swim class that day, from the swim school's commitments. */
export type DayClass = { ref: string; userId: string | null; startMinutes: number; endMinutes: number; title: string; place: string; planned: boolean };

/** Why a block on the timeline needs a second look. */
export type BlockWarning = "off" | "missing" | "expired" | "overlap" | "break";

export type Block = {
  kind: "on" | "gap";
  start: number;
  end: number;
  userId: string | null;
  name: string | null;
  /** A planned need's place, or a class (by its ref). */
  needId: string | null;
  place: number | null;
  assignmentId: string | null;
  classRef: string | null;
  /** "Stage 3", "St Mary's NS": what this block is, beyond its activity. */
  detail: string | null;
  warnings: BlockWarning[];
};
export type Lane = Block[];
export type Group = {
  key: string;
  /** The area it is in (`DayZone.key`). */
  zoneKey: string;
  typeId: string;
  name: string;
  icon: string;
  /** The area's name. */
  place: string;
  departmentId: string;
  requiredTypeId: string | null;
  requiredName: string | null;
  fromClasses: boolean;
  /** Planned in another module (`DayBooked`): where to change it, and that module's name. Read only here. */
  href: string | null;
  plannedIn: string | null;
  lanes: Lane[];
  /** Gaps counted as the planner sees them: back-to-back classes nobody teaches are one. */
  gapCount: number;
  needs: DayNeed[];
};
/** A shift put on the plan before its activities. */
export type DayPlannedShift = { id: string; userId: string; departmentId: string; startMinutes: number; endMinutes: number };
/** Something on the day a person on shift could take: a gap on an activity's place or a class
 *  nobody teaches, at the time it fits their shift (`start`-`end`), or why not (`why`). */
export type ShiftOption = {
  key: string; groupKey: string; name: string; area: string; departmentId: string; requiredName: string | null;
  needId: string | null; place: number | null; classRef: string | null; detail: string | null;
  gapStart: number; gapEnd: number; start: number; end: number; ok: boolean; why: string | null;
};
export type Person = {
  userId: string; name: string; shift: DayShift; activities: string[]; warnings: BlockWarning[];
  /** Their planned shifts that day. */
  planned: DayPlannedShift[];
  /** Under-18 rest warnings (`youngRest`). */
  rest: string[];
  /** Placed breaks that fall during an activity they are on: that time needs cover. A planned
   *  activity's place (`assignment`) can be handed to someone else for the break. */
  breakClashes: { start: number; end: number; label: string;
    assignment: { id: string; needId: string; place: number; typeId: string; requiredName: string | null; start: number; end: number } | null }[];
  /** What they could take inside their shifts, open ones first. */
  options: ShiftOption[];
};
/** An area on the day with the activities in it. `unmatched`: a place that is not on the site's
 *  list of areas (typed before the list, or since renamed or archived), so it can be fixed. */
export type DayZone = { key: string; name: string; unmatched: boolean; gapCount: number; groups: Group[] };
/** Something using an area at a time, for the zones at the top of the Plan (owner request, 13
 *  October 2026: "zones top, staff left"): a booking, an activity, a swim class or another
 *  module's session, with the lanes it takes (none for the whole area) and how many of its
 *  places still need someone. */
export type ZoneItem = {
  key: string; kind: "booking" | "activity" | "area" | "class" | "booked"; label: string; detail: string | null; start: number; end: number;
  lanes: number[]; departmentId: string; groupKey: string; needId: string | null; places: number; gaps: number; href: string | null;
};
/** One of the site's areas with how many lanes it has and what uses it that day. Every area on
 *  the site's list is here, in its order, even with nothing on; places not on it follow. */
export type ZoneBand = { key: string; name: string; lanes: number; unmatched: boolean; items: ZoneItem[] };
export type Day = { date: string; zones: DayZone[]; groups: Group[]; people: Person[]; gapCount: number; areas: ZoneBand[] };
/** A site's area as the day takes it: a name, or a name with its lanes, the hours it is open and
 *  the staff it needs then (Admin, Areas). */
export type DayArea = string | { id?: string; name: string; lanes: number; openFrom?: number | null; openUntil?: number | null; weekHours?: readonly WeekHour[]; minimums?: AreaMinimum[];
  /** Staff in another area covering this one while both are open. */
  together?: readonly AreaTogether[] };

export function buildDay(input: {
  date: string;
  types: readonly DayType[];
  needs: readonly DayNeed[];
  assignments: readonly DayAssignment[];
  /** People on the areas' own needs. */
  areaAssignments?: readonly DayAreaAssignment[];
  classes: readonly DayClass[];
  /** Other modules' sessions at the site (the Academy, Short courses). */
  booked?: readonly DayBooked[];
  names: ReadonlyMap<string, string>;
  /** The site's areas, in their order, with their lanes (Admin, Areas). */
  areas?: readonly DayArea[];
  /** Everyone's qualifications, for warnings on their blocks. */
  held?: readonly Held[];
  off?: ReadonlySet<string>;
  /** What else people are on that day elsewhere (other sites), for double bookings. */
  elsewhere?: ReadonlyMap<string, readonly WorkItem[]>;
  young?: ReadonlyMap<string, YoungBand>;
  /** Shifts put on the plan before their activities. */
  planned?: readonly DayPlannedShift[];
  /** Breaks the manager placed, by person. */
  pinned?: ReadonlyMap<string, readonly PinnedBreak[]>;
  /** Under-18 rest warnings, by person. */
  rest?: ReadonlyMap<string, readonly string[]>;
}): Day {
  const types = new Map(input.types.map((t) => [t.id, t]));
  const teaching = SWIM_CLASSES;
  const name = (id: string | null) => (id ? input.names.get(id) ?? "Someone" : null);
  const siteAreas = (input.areas ?? []).map((a) => (typeof a === "string" ? { name: a, lanes: 0 } : a));
  // Each area's own needs while it is open that day: one per type of staff, its places the number
  // it needs, on every department's plan. Only the people put on these count toward the area.
  // An area covered from another while both are open needs none of that type then, and the
  // other area needs the joint number in all (area-needs.ts).
  const areaNeeds: DayNeed[] = [];
  const own = areaNeedsOn(siteAreas.flatMap((a) => (a.id ? [{ ...a, id: a.id }] : [])), input.date);
  for (const n of own) {
    const id = n.typeId;
    types.set(id, { id, name: areaNeedName(n.qualificationTypeId ? n.typeName ?? "Qualified" : null), icon: "activity", departmentId: ANY_DEPARTMENT, requiredTypeId: n.qualificationTypeId,
      requiredName: n.qualificationTypeId ? n.typeName : null, fromClasses: false });
    areaNeeds.push({ id: n.id, typeId: id, place: n.areaName, startMinutes: n.startMinutes, endMinutes: n.endMinutes, places: n.places, note: "", repeatTitle: null, off: n.off, together: n.together });
  }
  // What each area needs stretch by stretch, for placing breaks.
  const open = new Map<string, (Span & { minimums: AreaMinimum[] })[]>();
  for (const a of siteAreas) {
    const mine = own.filter((n) => n.areaName === a.name);
    if (mine.length) open.set(`area:${a.name.toLowerCase()}`, areaMinimumsOver(mine));
  }
  const assignments = [...input.assignments, ...(input.areaAssignments ?? []).map((a): DayAssignment => ({
    id: `area:${a.id}`, needId: `${areaTypeId(a.areaId, a.typeId)}:${input.date}`, place: a.place, userId: a.userId, startMinutes: a.startMinutes, endMinutes: a.endMinutes }))];
  const areaOrder = new Map(siteAreas.map((a, i) => [a.name.trim().toLowerCase(), { name: a.name, i }]));
  const items = new Map<string, ZoneItem[]>();
  const addItem = (zone: DayZone, item: ZoneItem) => items.set(zone.key, [...(items.get(zone.key) ?? []), item]);
  const zones = new Map<string, DayZone & { order: number }>();
  /** The area a place names: one of the site's, in its order; else the place as typed, flagged. A
   *  class's location may add a detail after a comma ("Learner pool, lane 3"). */
  const zoneFor = (place: string) => {
    const name = place.split(",")[0].trim();
    const known = areaOrder.get(name.toLowerCase());
    const key = `area:${(known?.name ?? name).toLowerCase() || "-"}`;
    let z = zones.get(key);
    if (!z) {
      z = { key, name: known?.name ?? (name || "No area"), unmatched: !known, order: known ? known.i : 1e6, gapCount: 0, groups: [] };
      zones.set(key, z);
    }
    return z;
  };
  const groups = new Map<string, Group>();
  const groupFor = (type: DayType, zone: DayZone, href: string | null = null, plannedIn: string | null = null) => {
    const key = `${zone.key}|${type.id}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, zoneKey: zone.key, typeId: type.id, name: type.name, icon: type.icon, place: zone.name, departmentId: type.departmentId, requiredTypeId: type.requiredTypeId,
        requiredName: type.requiredName, fromClasses: type.fromClasses, href, plannedIn, lanes: [], gapCount: 0, needs: [] };
      groups.set(key, g);
      zone.groups.push(g);
    }
    return g;
  };
  const blank = { userId: null, name: null, needId: null, place: null, assignmentId: null, classRef: null, detail: null, warnings: [] as BlockWarning[] };

  // Every person's work that day here, for their shift and their double bookings.
  const work = new Map<string, WorkItem[]>();
  const add = (userId: string, item: WorkItem) => work.set(userId, [...(work.get(userId) ?? []), item]);

  for (const need of [...input.needs, ...areaNeeds].sort((a, b) => a.startMinutes - b.startMinutes)) {
    const type = types.get(need.typeId);
    if (!type) continue;
    const zone = zoneFor(need.place);
    const g = groupFor(type, zone);
    g.needs.push(need);
    addItem(zone, { key: `need:${need.id}`, kind: isAreaNeed(need.id) ? "area" : need.repeatTitle ? "booking" : "activity", label: need.repeatTitle ?? type.name, detail: need.repeatTitle ? type.name : null,
      start: need.startMinutes, end: need.endMinutes, lanes: [...(need.lanes ?? [])], departmentId: type.departmentId, groupKey: g.key, needId: need.id, places: need.places, gaps: 0, href: null });
    const mine = assignments.filter((a) => a.needId === need.id);
    const gaps = needGaps(need, mine).flatMap((x) => lessOff(x, x.place, need.off).map((s) => ({ ...x, ...s })));
    for (let place = 1; place <= need.places; place++) {
      const lane: Lane = [
        ...mine.filter((a) => a.place === place).map((a): Block => {
          add(a.userId, { start: a.startMinutes, end: a.endMinutes, label: type.name });
          return { ...blank, kind: "on", start: a.startMinutes, end: a.endMinutes, userId: a.userId, name: name(a.userId), needId: need.id, place, assignmentId: a.id, detail: need.repeatTitle, warnings: [] };
        }),
        ...gaps.filter((x) => x.place === place).map((x): Block => ({ ...blank, kind: "gap", start: x.start, end: x.end, needId: need.id, place, detail: need.repeatTitle, warnings: [] })),
      ].sort((a, b) => a.start - b.start);
      g.lanes.push(lane);
    }
  }

  {
    const byPlace = new Map<string, DayClass[]>();
    for (const c of input.classes) byPlace.set(c.place, [...(byPlace.get(c.place) ?? []), c]);
    for (const [place, classes] of byPlace) {
      const zone = zoneFor(place);
      const g = groupFor(teaching, zone);
      for (const c of classes) addItem(zone, { key: `class:${c.ref}`, kind: "class", label: c.title, detail: teaching.name, start: c.startMinutes, end: c.endMinutes,
        lanes: lanesInPlace(c.place), departmentId: teaching.departmentId, groupKey: g.key, needId: null, places: 1, gaps: 0, href: null });
      // One lane per teacher (more only if their classes overlap), then the classes nobody teaches.
      const teachers = [...new Set(classes.map((c) => c.userId))].sort((a, b) => (a === null ? 1 : 0) - (b === null ? 1 : 0)
        || Math.min(...classes.filter((c) => c.userId === a).map((c) => c.startMinutes)) - Math.min(...classes.filter((c) => c.userId === b).map((c) => c.startMinutes)));
      const lanes = teachers.flatMap((who) => intoLanes(classes.filter((c) => c.userId === who).map((c) => ({ start: c.startMinutes, end: c.endMinutes, key: c.userId, c }))));
      for (const lane of lanes) {
        const blocks = lane.map(({ c }): Block => {
          if (c.userId) add(c.userId, { start: c.startMinutes, end: c.endMinutes, label: c.title || teaching.name });
          return { ...blank, kind: c.userId ? "on" : "gap", start: c.startMinutes, end: c.endMinutes, userId: c.userId, name: name(c.userId), classRef: c.ref, detail: c.title, warnings: [] };
        });
        g.lanes.push(blocks);
      }
    }
  }

  // Other modules' sessions: one activity per title in its area, a lane per person on it.
  for (const b of input.booked ?? []) {
    const type: DayType = { id: `booked:${b.title.toLowerCase()}`, name: b.title, icon: "teaching", departmentId: ANY_DEPARTMENT, requiredTypeId: null, requiredName: null, fromClasses: false };
    const zone = zoneFor(b.place);
    const g = groupFor(type, zone, b.href, b.module ?? null);
    addItem(zone, { key: `booked:${b.ref}`, kind: "booked", label: b.title, detail: b.module ? `Planned in ${b.module}` : null, start: b.startMinutes, end: b.endMinutes,
      lanes: lanesInPlace(b.place), departmentId: ANY_DEPARTMENT, groupKey: g.key, needId: null, places: 1, gaps: 0, href: b.href });
    if (b.userId) add(b.userId, { start: b.startMinutes, end: b.endMinutes, label: b.title });
    const block: Block = { ...blank, kind: b.userId ? "on" : "gap", start: b.startMinutes, end: b.endMinutes, userId: b.userId, name: name(b.userId), detail: b.module ?? "Booked", warnings: [] };
    const lane = g.lanes.find((l) => l.every((x) => x.userId === b.userId && (x.end <= b.startMinutes || x.start >= b.endMinutes)));
    if (lane) lane.push(block); else g.lanes.push([block]);
  }

  // Warnings on each block someone is on: off that day, the activity's qualification, and
  // anything else they are on at the same time (here or at another site).
  for (const g of groups.values()) {
    for (const lane of g.lanes) {
      for (const b of lane) {
        if (b.kind !== "on" || !b.userId) continue;
        if (input.off?.has(b.userId)) b.warnings.push("off");
        const q = qualification(input.held ?? [], b.userId, g.requiredTypeId, input.date);
        if (input.held && q !== "ok") b.warnings.push(q);
        const others = [...(work.get(b.userId) ?? []), ...(input.elsewhere?.get(b.userId) ?? [])];
        if (others.filter((w) => w.start < b.end && b.start < w.end).length > 1) b.warnings.push("overlap");
      }
    }
  }

  // Gaps: time nobody is on, and time someone who is off is on (it needs cover). Back-to-back
  // classes count once; a planned activity's gaps and its absent people count one by one.
  for (const g of groups.values()) {
    if (g.href) { g.gapCount = 0; continue; }
    g.gapCount = g.lanes.reduce((n, lane) => {
      const open = lane.filter(needsCover);
      return n + (g.fromClasses ? mergeTouching(open).length : open.length);
    }, 0);
  }

  // Areas in the site's order (Admin, Areas), places not on the list after them; inside an area,
  // its own needs, planned activities by name, then the swim classes.
  const orderedZones: DayZone[] = [...zones.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)).map(({ order: _order, ...z }) => {
    void _order;
    const inZone = z.groups.sort((a, b) => Number(!isAreaNeed(a.typeId)) - Number(!isAreaNeed(b.typeId)) || Number(a.fromClasses) - Number(b.fromClasses) || a.name.localeCompare(b.name));
    return { ...z, groups: inZone, gapCount: inZone.reduce((n, g) => n + g.gapCount, 0) };
  });
  const ordered = orderedZones.flatMap((z) => z.groups);
  const planned = input.planned ?? [];
  const everyone = [...new Set([...work.keys(), ...planned.map((p) => p.userId)])];
  const shifts = new Map(everyone.map((userId) => {
    const mine = planned.filter((p) => p.userId === userId).sort((a, b) => a.startMinutes - b.startMinutes);
    return [userId, dayShift(work.get(userId) ?? [], input.young?.get(userId) ?? null, { planned: mine.map((p) => ({ start: p.startMinutes, end: p.endMinutes })), pinned: input.pinned?.get(userId) ?? [] })!];
  }));
  // Breaks (owner requests, 16 October 2026): someone on an area's own need whose breaks have no
  // free time gets them where the area is least short without them, never two away at once when
  // it can be helped. That time then shows as a place to fill. Never off a booking, an activity,
  // a class or another module's session.
  const onIn = (userId: string) => ordered.flatMap((g) => g.lanes.flat().filter((b) => b.kind === "on" && b.userId === userId).map((b) => ({ g, b })));
  const presence = new Map<string, Presence[]>();
  for (const g of ordered) {
    if (!isAreaNeed(g.typeId) || !open.has(g.zoneKey)) continue;
    for (const b of g.lanes.flat()) if (b.kind === "on" && b.userId && !b.warnings.includes("off")) presence.set(g.zoneKey, [...(presence.get(g.zoneKey) ?? []), { userId: b.userId, start: b.start, end: b.end }]);
  }
  // Whoever is on a place counts for it here, qualified or not (that shows as a warning on them).
  const shortIn = (key: string, list: readonly Presence[], within: { start: number; end: number }) => open.get(key)!.reduce((n, seg) => n + shortWeight(seg.minimums, [seg], list, () => true, within), 0);
  // Placed breaks take people out of their area first.
  for (const [userId, shift] of shifts) for (const part of shift.parts) for (const x of part.breaks) for (const key of presence.keys()) presence.set(key, without(presence.get(key) ?? [], userId, x));
  if (presence.size) {
    for (const userId of [...shifts.keys()].sort((a, b) => shifts.get(a)!.start - shifts.get(b)!.start || a.localeCompare(b))) {
      const blocks = onIn(userId);
      for (const part of shifts.get(userId)!.parts) {
        part.unplaced = part.unplaced.filter((u) => {
          let best: { at: number; cost: number } | null = null;
          for (let at = Math.ceil(part.start / 15) * 15; at + u.minutes <= part.end; at += 15) {
            const slot = { start: at, end: at + u.minutes };
            if (part.breaks.some((x) => x.start < slot.end && slot.start < x.end)) continue;
            const during = blocks.filter(({ b }) => b.start < slot.end && slot.start < b.end);
            if (!during.length || during.some(({ g }) => !isAreaNeed(g.typeId) || !open.has(g.zoneKey))) continue;
            const keys = [...new Set(during.map(({ g }) => g.zoneKey))];
            const cost = keys.reduce((n, key) => n + shortIn(key, without(presence.get(key) ?? [], userId, slot), slot) - shortIn(key, presence.get(key) ?? [], slot), 0);
            const aim = u.aim ?? (part.start + part.end) / 2;
            if (!best || cost < best.cost || (cost === best.cost && Math.abs(at - aim) < Math.abs(best.at - aim))) best = { at, cost };
          }
          if (!best) return true;
          const x = { start: best.at, end: best.at + u.minutes, paid: u.paid, pinned: false };
          part.breaks = [...part.breaks, x].sort((a, b) => a.start - b.start);
          for (const key of presence.keys()) presence.set(key, without(presence.get(key) ?? [], userId, x));
          return false;
        });
      }
    }
  }
  // A break during an area's need leaves that place to fill for its time.
  for (const g of ordered) {
    if (!isAreaNeed(g.typeId)) continue;
    g.lanes = g.lanes.map((lane) => lane.flatMap((b): Block[] => {
      if (b.kind !== "on" || !b.userId) return [b];
      const away = (shifts.get(b.userId)?.parts ?? []).flatMap((p) => p.breaks).filter((x) => x.start < b.end && b.start < x.end);
      if (!away.length) return [b];
      const off = g.needs.find((n) => n.id === b.needId)?.off;
      const gaps = away.flatMap((x) => lessOff({ start: Math.max(b.start, x.start), end: Math.min(b.end, x.end) }, b.place, off))
        .map((x): Block => ({ ...blank, kind: "gap", start: x.start, end: x.end, needId: b.needId, place: b.place, detail: `${b.name ?? "Someone"}'s break` }));
      return [...subtract(b, away).map((s): Block => ({ ...b, start: s.start, end: s.end })), ...gaps].sort((x, y) => x.start - y.start);
    }));
    g.gapCount = g.lanes.reduce((n, lane) => n + lane.filter(needsCover).length, 0);
  }
  for (const z of orderedZones) z.gapCount = z.groups.reduce((n, g) => n + g.gapCount, 0);
  const people: Person[] = everyone.map((userId) => {
    const items = work.get(userId) ?? [];
    const mine = planned.filter((p) => p.userId === userId).sort((a, b) => a.startMinutes - b.startMinutes);
    const shift = shifts.get(userId)!;
    // A break during something they are on takes them off it: say so on the block.
    const breaks = shift.parts.flatMap((p) => p.breaks);
    const breakClashes: Person["breakClashes"] = [];
    for (const { g, b } of onIn(userId)) {
      for (const x of breaks) if (x.start < b.end && b.start < x.end) {
        const span = { start: Math.max(x.start, b.start), end: Math.min(x.end, b.end) };
        if (!b.warnings.includes("break")) b.warnings.push("break");
        breakClashes.push({ ...span, label: `${(b.classRef && b.detail) || g.name} in ${g.place}`,
          assignment: b.assignmentId && b.needId && b.place ? { id: b.assignmentId, needId: b.needId, place: b.place, typeId: g.typeId, requiredName: g.requiredName, start: b.start, end: b.end } : null });
      }
    }
    const warnings = new Set<BlockWarning>();
    for (const g of ordered) for (const lane of g.lanes) for (const b of lane) if (b.userId === userId) b.warnings.forEach((w) => warnings.add(w));
    return { userId, name: name(userId) ?? "Someone", shift, activities: [...new Set(items.map((i) => i.label))], warnings: [...warnings], planned: mine,
      rest: [...(input.rest?.get(userId) ?? [])], breakClashes, options: shiftOptions(ordered, userId, shift, items, input) };
  }).sort((a, b) => a.shift.start - b.shift.start || a.name.localeCompare(b.name));
  // What uses each area, with the places still to fill: a need's own gaps, a class nobody
  // teaches (or whose teacher is off).
  for (const g of ordered) for (const lane of g.lanes) for (const b of lane) {
    if (!needsCover(b) || g.href) continue;
    const key = b.needId ? `need:${b.needId}` : b.classRef ? `class:${b.classRef}` : null;
    const item = key ? items.get(g.zoneKey)?.find((i) => i.key === key) : null;
    if (item) item.gaps += 1;
  }
  const bandOf = (key: string, name: string, lanes: number, unmatched: boolean): ZoneBand => ({ key, name, lanes, unmatched,
    items: (items.get(key) ?? []).sort((a, b) => a.start - b.start || a.end - b.end || a.label.localeCompare(b.label)) });
  const areas = [
    ...siteAreas.map((a) => bandOf(`area:${a.name.toLowerCase()}`, a.name, a.lanes, false)),
    ...orderedZones.filter((z) => z.unmatched).map((z) => bandOf(z.key, z.name, 0, true)),
  ];
  return { date: input.date, zones: orderedZones, groups: ordered, people, gapCount: ordered.reduce((n, g) => n + g.gapCount, 0), areas };
}

/** A block that needs someone: nobody is on it, or the person on it is off that day. */
function needsCover(b: Block) {
  return b.kind === "gap" || b.warnings.includes("off");
}

export type DayGap = {
  group: Group; start: number; end: number; needId: string | null; place: number | null; classRefs: string[]; count: number;
  /** The person on it who is off: covering swaps them on that place. */
  off: { assignmentId: string | null; userId: string; name: string } | null;
};

/** Every gap on the day, soonest first, with its group: the duty manager's list on Today. */
export function dayGaps(day: Day): DayGap[] {
  const out: DayGap[] = [];
  for (const g of day.groups) {
    if (g.href) continue;
    for (const lane of g.lanes) {
      const open = lane.filter(needsCover);
      if (g.fromClasses) {
        // A run of classes is one gap, keeping every class it covers.
        for (const r of mergeTouching(open)) {
          const refs = open.filter((b) => b.start >= r.start && b.end <= r.end).map((b) => b.classRef!);
          const offOne = open.find((b) => b.start >= r.start && b.end <= r.end && b.userId);
          out.push({ group: g, start: r.start, end: r.end, needId: null, place: null, classRefs: refs, count: r.count,
            off: offOne ? { assignmentId: null, userId: offOne.userId!, name: offOne.name ?? "Someone" } : null });
        }
      } else {
        for (const b of open) out.push({ group: g, start: b.start, end: b.end, needId: b.needId, place: b.place, classRefs: [], count: 1,
          off: b.kind === "on" ? { assignmentId: b.assignmentId, userId: b.userId!, name: b.name ?? "Someone" } : null });
      }
    }
  }
  return out.sort((a, b) => a.start - b.start || a.group.name.localeCompare(b.group.name));
}

/** What someone on shift could take that day (owner decision, 8 October 2026: "add a staff
 *  member to a shift, then assign activities to them based on the activities we have on the
 *  day"): every gap inside their shifts, at the longest stretch they have free for it (their
 *  placed breaks count, suggested ones do not), with why
 *  not when they cannot (not qualified, off, already busy). Open ones first, then by time. */
function shiftOptions(groups: readonly Group[], userId: string, shift: DayShift, work: readonly WorkItem[], input: { date: string; held?: readonly Held[]; off?: ReadonlySet<string> }): ShiftOption[] {
  // Breaks the manager placed count as busy; suggestions do not, they move once the time is taken.
  const busy = [...work, ...shift.parts.flatMap((p) => p.breaks.filter((b) => b.pinned))];
  const out: ShiftOption[] = [];
  for (const g of groups) {
    if (g.href) continue;
    const q = qualification(input.held ?? [], userId, g.requiredTypeId, input.date);
    g.lanes.forEach((lane, li) => lane.forEach((b) => {
      if (b.kind !== "gap") return;
      for (const part of shift.parts) {
        const s = Math.max(b.start, part.start), e = Math.min(b.end, part.end);
        if (e - s < 15) continue;
        const free = subtract({ start: s, end: e }, busy).sort((x, y) => y.end - y.start - (x.end - x.start))[0];
        const why = input.off?.has(userId) ? "Off that day"
          : input.held && q === "missing" ? `Needs ${g.requiredName ?? "a qualification"}`
          : input.held && q === "expired" ? `${g.requiredName ?? "Qualification"} expired`
          : !free || free.end - free.start < 15 ? "Busy then" : null;
        out.push({ key: `${g.key}|${li}|${b.start}|${part.start}`, groupKey: g.key, name: g.name, area: g.place, departmentId: g.departmentId, requiredName: g.requiredName,
          needId: b.needId, place: b.place, classRef: b.classRef, detail: b.detail, gapStart: b.start, gapEnd: b.end,
          start: free?.start ?? s, end: free?.end ?? e, ok: !why, why });
      }
    }));
  }
  return out.sort((a, b) => Number(b.ok) - Number(a.ok) || a.start - b.start || a.name.localeCompare(b.name));
}
