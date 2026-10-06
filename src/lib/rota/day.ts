import { intoLanes, mergeTouching, needGaps } from "@/lib/rota/cover";
import { qualification, type Held } from "@/lib/rota/fit";
import { dayShift, type DayShift, type WorkItem } from "@/lib/rota/shifts";
import type { YoungBand } from "@/lib/rota/constants";

/** One day at one site, as every Rota screen draws it (Plan, Today, Turnfin Me): its activities
 *  grouped by kind and place, each place a lane of people and gaps, the swim classes as Teaching,
 *  and each person's shift worked out from what they are on. Pure: the loaders read the rows and
 *  this lays them out (day.test.ts). */

export type DayType = { id: string; name: string; icon: string; departmentId: string; requiredTypeId: string | null; requiredName: string | null; fromClasses: boolean };
export type DayNeed = { id: string; typeId: string; place: string; startMinutes: number; endMinutes: number; places: number; note: string; repeatTitle: string | null };
export type DayAssignment = { id: string; needId: string; place: number; userId: string; startMinutes: number; endMinutes: number };
/** A swim class that day, from the swim school's commitments. */
export type DayClass = { ref: string; userId: string | null; startMinutes: number; endMinutes: number; title: string; place: string; planned: boolean };

/** Why a block on the timeline needs a second look. */
export type BlockWarning = "off" | "missing" | "expired" | "overlap";

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
  typeId: string;
  name: string;
  icon: string;
  place: string;
  departmentId: string;
  requiredTypeId: string | null;
  requiredName: string | null;
  fromClasses: boolean;
  lanes: Lane[];
  /** Gaps counted as the planner sees them: back-to-back classes nobody teaches are one. */
  gapCount: number;
  needs: DayNeed[];
};
export type Person = { userId: string; name: string; shift: DayShift; activities: string[]; warnings: BlockWarning[] };
export type Day = { date: string; groups: Group[]; people: Person[]; gapCount: number };

export function buildDay(input: {
  date: string;
  types: readonly DayType[];
  needs: readonly DayNeed[];
  assignments: readonly DayAssignment[];
  classes: readonly DayClass[];
  names: ReadonlyMap<string, string>;
  /** Everyone's qualifications, for warnings on their blocks. */
  held?: readonly Held[];
  off?: ReadonlySet<string>;
  /** What else people are on that day elsewhere (other sites), for double bookings. */
  elsewhere?: ReadonlyMap<string, readonly WorkItem[]>;
  young?: ReadonlyMap<string, YoungBand>;
}): Day {
  const types = new Map(input.types.map((t) => [t.id, t]));
  const teaching = input.types.find((t) => t.fromClasses) ?? null;
  const name = (id: string | null) => (id ? input.names.get(id) ?? "Someone" : null);
  const groups = new Map<string, Group>();
  const groupFor = (type: DayType, place: string) => {
    const key = `${type.id}|${place.trim().toLowerCase()}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, typeId: type.id, name: type.name, icon: type.icon, place: place.trim(), departmentId: type.departmentId, requiredTypeId: type.requiredTypeId,
        requiredName: type.requiredName, fromClasses: type.fromClasses, lanes: [], gapCount: 0, needs: [] };
      groups.set(key, g);
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
    const g = groupFor(type, need.place);
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
      const g = groupFor(teaching, place);
      const lanes = intoLanes(classes.map((c) => ({ start: c.startMinutes, end: c.endMinutes, key: c.userId, c })));
      for (const lane of lanes) {
        const blocks = lane.map(({ c }): Block => {
          if (c.userId) add(c.userId, { start: c.startMinutes, end: c.endMinutes, label: teaching.name });
          return { ...blank, kind: c.userId ? "on" : "gap", start: c.startMinutes, end: c.endMinutes, userId: c.userId, name: name(c.userId), classRef: c.ref, detail: c.title, warnings: [] };
        });
        g.lanes.push(blocks);
      }
    }
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
    g.gapCount = g.lanes.reduce((n, lane) => {
      const open = lane.filter(needsCover);
      return n + (g.fromClasses ? mergeTouching(open).length : open.length);
    }, 0);
  }

  const ordered = [...groups.values()].sort((a, b) => Number(a.fromClasses) - Number(b.fromClasses)
    || (types.get(a.typeId) ? 0 : 1) - (types.get(b.typeId) ? 0 : 1) || a.name.localeCompare(b.name) || a.place.localeCompare(b.place));
  const people: Person[] = [...work.entries()].map(([userId, items]) => {
    const shift = dayShift(items, input.young?.get(userId) ?? null)!;
    const warnings = new Set<BlockWarning>();
    for (const g of ordered) for (const lane of g.lanes) for (const b of lane) if (b.userId === userId) b.warnings.forEach((w) => warnings.add(w));
    return { userId, name: name(userId)!, shift, activities: [...new Set(items.map((i) => i.label))], warnings: [...warnings] };
  }).sort((a, b) => a.shift.start - b.shift.start || a.name.localeCompare(b.name));
  return { date: input.date, groups: ordered, people, gapCount: ordered.reduce((n, g) => n + g.gapCount, 0) };
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
