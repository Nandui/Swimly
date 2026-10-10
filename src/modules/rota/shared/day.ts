import { intoLanes, mergeTouching, needGaps } from "@/modules/rota/shared/cover";
import { qualification, type Held } from "@/modules/rota/shared/fit";
import { subtract } from "@/modules/rota/shared/cover";
import { dayShift, type DayShift, type PinnedBreak, type WorkItem } from "@/modules/rota/shared/shifts";
import type { YoungBand } from "@/modules/rota/shared/constants";

/** One day at one site, as every Rota screen draws it (Plan, Today, Turnfin Me): its **areas**
 *  (the site's list in Admin, Areas: Main pool, Learner pool, Front desk; owner decisions, 6 and 7
 *  October 2026), each with the activities in it, each activity's places a lane of people and
 *  gaps; the swim classes as Teaching in the area their location names ("Learner pool, lane 3");
 *  and each person's shift worked out from what they are on. Pure: the loaders read the rows and
 *  this lays them out (day.test.ts). */

export type DayType = { id: string; name: string; icon: string; departmentId: string; requiredTypeId: string | null; requiredName: string | null; fromClasses: boolean };
export type DayNeed = { id: string; typeId: string; place: string; startMinutes: number; endMinutes: number; places: number; note: string; repeatTitle: string | null };
export type DayAssignment = { id: string; needId: string; place: number; userId: string; startMinutes: number; endMinutes: number };
/** Something another module has on at the site (an Academy course session), from the
 *  commitments seam: drawn in its area for whoever is on it, planned in that module. */
export type DayBooked = { ref: string; userId: string | null; startMinutes: number; endMinutes: number; title: string; place: string; href: string | null };
/** Booked things sit on every department's plan: the time and the area are taken. */
export const ANY_DEPARTMENT = "*";
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
  /** Planned in another module (`DayBooked`): where to change it. Read only here. */
  href: string | null;
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
  /** Placed breaks that fall during an activity they are on: that time needs cover. */
  breakClashes: { start: number; end: number; label: string }[];
  /** What they could take inside their shifts, open ones first. */
  options: ShiftOption[];
};
/** An area on the day with the activities in it. `unmatched`: a place that is not on the site's
 *  list of areas (typed before the list, or since renamed or archived), so it can be fixed. */
export type DayZone = { key: string; name: string; unmatched: boolean; gapCount: number; groups: Group[] };
export type Day = { date: string; zones: DayZone[]; groups: Group[]; people: Person[]; gapCount: number };

export function buildDay(input: {
  date: string;
  types: readonly DayType[];
  needs: readonly DayNeed[];
  assignments: readonly DayAssignment[];
  classes: readonly DayClass[];
  /** Other modules' sessions at the site (the Academy). */
  booked?: readonly DayBooked[];
  names: ReadonlyMap<string, string>;
  /** The site's areas, in their order (Admin, Areas). */
  areas?: readonly string[];
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
  const teaching = input.types.find((t) => t.fromClasses) ?? null;
  const name = (id: string | null) => (id ? input.names.get(id) ?? "Someone" : null);
  const areaOrder = new Map((input.areas ?? []).map((a, i) => [a.trim().toLowerCase(), { name: a, i }]));
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
  const groupFor = (type: DayType, zone: DayZone, href: string | null = null) => {
    const key = `${zone.key}|${type.id}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, zoneKey: zone.key, typeId: type.id, name: type.name, icon: type.icon, place: zone.name, departmentId: type.departmentId, requiredTypeId: type.requiredTypeId,
        requiredName: type.requiredName, fromClasses: type.fromClasses, href, lanes: [], gapCount: 0, needs: [] };
      groups.set(key, g);
      zone.groups.push(g);
    }
    return g;
  };
  const blank = { userId: null, name: null, needId: null, place: null, assignmentId: null, classRef: null, detail: null, warnings: [] as BlockWarning[] };

  // Every person's work that day here, for their shift and their double bookings.
  const work = new Map<string, WorkItem[]>();
  const add = (userId: string, item: WorkItem) => work.set(userId, [...(work.get(userId) ?? []), item]);

  for (const need of [...input.needs].sort((a, b) => a.startMinutes - b.startMinutes)) {
    const type = types.get(need.typeId);
    if (!type) continue;
    const g = groupFor(type, zoneFor(need.place));
    g.needs.push(need);
    const mine = input.assignments.filter((a) => a.needId === need.id);
    const gaps = needGaps(need, mine);
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

  if (teaching) {
    const byPlace = new Map<string, DayClass[]>();
    for (const c of input.classes) byPlace.set(c.place, [...(byPlace.get(c.place) ?? []), c]);
    for (const [place, classes] of byPlace) {
      const g = groupFor(teaching, zoneFor(place));
      // One lane per teacher (more only if their classes overlap), then the classes nobody teaches.
      const teachers = [...new Set(classes.map((c) => c.userId))].sort((a, b) => (a === null ? 1 : 0) - (b === null ? 1 : 0)
        || Math.min(...classes.filter((c) => c.userId === a).map((c) => c.startMinutes)) - Math.min(...classes.filter((c) => c.userId === b).map((c) => c.startMinutes)));
      const lanes = teachers.flatMap((who) => intoLanes(classes.filter((c) => c.userId === who).map((c) => ({ start: c.startMinutes, end: c.endMinutes, key: c.userId, c }))));
      for (const lane of lanes) {
        const blocks = lane.map(({ c }): Block => {
          if (c.userId) add(c.userId, { start: c.startMinutes, end: c.endMinutes, label: teaching.name });
          return { ...blank, kind: c.userId ? "on" : "gap", start: c.startMinutes, end: c.endMinutes, userId: c.userId, name: name(c.userId), classRef: c.ref, detail: c.title, warnings: [] };
        });
        g.lanes.push(blocks);
      }
    }
  }

  // Other modules' sessions: one activity per title in its area, a lane per person on it.
  for (const b of input.booked ?? []) {
    const type: DayType = { id: `booked:${b.title.toLowerCase()}`, name: b.title, icon: "teaching", departmentId: ANY_DEPARTMENT, requiredTypeId: null, requiredName: null, fromClasses: false };
    const g = groupFor(type, zoneFor(b.place), b.href);
    if (b.userId) add(b.userId, { start: b.startMinutes, end: b.endMinutes, label: b.title });
    const block: Block = { ...blank, kind: b.userId ? "on" : "gap", start: b.startMinutes, end: b.endMinutes, userId: b.userId, name: name(b.userId), detail: "Academy", warnings: [] };
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
  // planned activities by name, then the swim classes.
  const orderedZones: DayZone[] = [...zones.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)).map(({ order: _order, ...z }) => {
    void _order;
    const inZone = z.groups.sort((a, b) => Number(a.fromClasses) - Number(b.fromClasses) || a.name.localeCompare(b.name));
    return { ...z, groups: inZone, gapCount: inZone.reduce((n, g) => n + g.gapCount, 0) };
  });
  const ordered = orderedZones.flatMap((z) => z.groups);
  const planned = input.planned ?? [];
  const everyone = [...new Set([...work.keys(), ...planned.map((p) => p.userId)])];
  const people: Person[] = everyone.map((userId) => {
    const items = work.get(userId) ?? [];
    const mine = planned.filter((p) => p.userId === userId).sort((a, b) => a.startMinutes - b.startMinutes);
    const shift = dayShift(items, input.young?.get(userId) ?? null, { planned: mine.map((p) => ({ start: p.startMinutes, end: p.endMinutes })), pinned: input.pinned?.get(userId) ?? [] })!;
    // A placed break during something they are on takes them off it: say so on the block.
    const placed = shift.parts.flatMap((p) => p.breaks.filter((b) => b.pinned));
    const breakClashes: Person["breakClashes"] = [];
    for (const g of ordered) for (const lane of g.lanes) for (const b of lane) {
      if (b.userId !== userId || b.kind !== "on") continue;
      for (const x of placed) if (x.start < b.end && b.start < x.end) {
        if (!b.warnings.includes("break")) b.warnings.push("break");
        breakClashes.push({ start: Math.max(x.start, b.start), end: Math.min(x.end, b.end), label: `${g.name} in ${g.place}` });
      }
    }
    const warnings = new Set<BlockWarning>();
    for (const g of ordered) for (const lane of g.lanes) for (const b of lane) if (b.userId === userId) b.warnings.forEach((w) => warnings.add(w));
    return { userId, name: name(userId) ?? "Someone", shift, activities: [...new Set(items.map((i) => i.label))], warnings: [...warnings], planned: mine,
      rest: [...(input.rest?.get(userId) ?? [])], breakClashes, options: shiftOptions(ordered, userId, shift, items, input) };
  }).sort((a, b) => a.shift.start - b.shift.start || a.name.localeCompare(b.name));
  return { date: input.date, zones: orderedZones, groups: ordered, people, gapCount: ordered.reduce((n, g) => n + g.gapCount, 0) };
}

/** A block that needs someone: nobody is on it, or the person on it is off that day. */
export function needsCover(b: Block) {
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
