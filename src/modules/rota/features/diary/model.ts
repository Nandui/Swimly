import { areaNeedsOn, type NeedArea } from "@/modules/rota/shared/area-needs";
import { breakEntitlement, clock, type YoungBand } from "@/modules/rota/shared/constants";
import { qualification, type Held } from "@/modules/rota/shared/fit";

/** The Plan as the day's diary, worked out from scratch (owner, 20 October 2026: "a feature that
 *  allows a department supervisor to plan the whole day for the staff in that department,
 *  including breaks, who covers what activities, when they change to others, when they cover
 *  bookings ... the plan, the diary, the actual guide for the day"), with his rules of that
 *  evening:
 *  - What needs people comes first. An area's own need (Admin, Areas) and each activity,
 *    booking or swim class in it are separate needs that add up: an aqua-fit instructor does
 *    not count towards the pool's lifeguards.
 *  - An area's need can be people on an activity there (owner, 21 October 2026: "the need for a
 *    reception area is to have someone at least during a specific time assigned to the activity
 *    of serving customers, if no one is, that's a gap"): anyone on that activity in the area or
 *    its parts counts, whatever put them on it.
 *  - Needs first, shifts follow: someone's day is what they are on, and their shift is made or
 *    stretched to hold it. A shift planned on its own (before anything is given) still counts.
 *  - Someone on a break is not covering anything, so a break during their work is a hole.
 *  - Who could fill a hole: best fits first, the department's own people, then anyone else's.
 *  - A day is done when every need is filled; warnings never block.
 *  Pure (model.test.ts): the loader reads the saved records, this lays out the day. */

export type Span = { start: number; end: number };
export type NeedKind = "area" | "activity" | "booking" | "class";

/** Something on the day that needs people. */
export type Need = {
  key: string;
  kind: NeedKind;
  /** "Lifeguard on duty", "Aqua-fit", "Party: Murphy", "Sharks 2". */
  title: string;
  /** The activity it is ("Party host"), when the title is a booking's name. */
  detail: string | null;
  /** The area it is in, "" for none. */
  area: string;
  /** The area that one is part of (Pool for the 25 m; owner, 20 October 2026), "" for none. */
  group: string;
  /** The department whose work it is; null for an area's own need and swim classes. */
  departmentId: string | null;
  start: number;
  end: number;
  /** How many people it needs, stretch by stretch. */
  wants: (Span & { count: number })[];
  requiredTypeId: string | null;
  requiredName: string | null;
  /** "Covered from Main hall 09:00–21:00". */
  note: string | null;
  /** The activity it is, for an activity or booking (its sub-activities). */
  typeId: string | null;
  /** What a change is saved against: the rota need (activity, booking or area need) or the class. */
  needId: string | null;
  classRef: string | null;
  /** An area's activity line: who counts is anyone on this activity in these areas (the area and
   *  its parts, lower case), not people put on the need itself. */
  onActivity: { typeId: string; areas: string[] } | null;
  /** An area's staff needed (owner, 21 October 2026: "if that activity is for reception ... that
   *  time of that activity means its covered"): anyone on an activity in the area or its parts
   *  counts too (`coveredBy`). When the activity asks for a qualification one of the area's lines
   *  asks for, it counts only for that line; otherwise only for a line that asks for none, so an
   *  aqua-fit instructor is not one of the pool's lifeguards. `lines`: every line's qualification. */
  coveredBy?: { areas: string[]; lines: (string | null)[] } | null;
};

/** Something one person is on. */
export type Line = Span & {
  key: string;
  userId: string;
  needKey: string;
  kind: NeedKind;
  title: string;
  /** The activity it is, for an activity or booking. */
  typeId: string | null;
  area: string;
  /** The area that one is part of, "" for none. */
  group: string;
  /** Sub-activities they do while on it, in order: at a time, or one done any time that the Plan
   *  has not placed yet (`at` null). One at several times is here once for each; `id` is its saved
   *  record, for moving one placed on the Plan. */
  subs: { id?: string; name: string; when: string; at: number | null }[];
  /** The saved record: an activity or booking place, an area place, or the class taught. */
  assignmentId: string | null;
  place: number | null;
  /** The qualification its activity asks for, for an activity. */
  requiredTypeId?: string | null;
};

/** A stretch of a need with fewer people than it needs. */
export type Hole = Span & {
  key: string;
  needKey: string;
  short: number;
  /** Nobody is on it then at all, rather than too few. */
  empty: boolean;
  /** "Nobody yet", "1 more needed", "Aoife is off", "Aoife is on a break". */
  why: string;
};

export type Break = Span & { paid: boolean; placed: boolean };
export type Warning =
  | { kind: "off" } | { kind: "overlap"; with: string } | { kind: "qualification"; what: string; name: string; state: "missing" | "expired" }
  | { kind: "unplaced"; minutes: number } | { kind: "breakCover"; what: string } | { kind: "young" };

export type PersonDay = {
  userId: string;
  name: string;
  /** Their departments, their main one first. */
  departmentIds: string[];
  lines: Line[];
  /** The stretches they work, split where they are off for an hour or more between. */
  parts: Span[];
  breaks: Break[];
  /** Time inside their shift nothing is given to yet. */
  free: Span[];
  paidMinutes: number;
  /** Planned shifts on the day (their ids, for changing them), any department. */
  shifts: (Span & { id: string; departmentId: string })[];
  warnings: Warning[];
  off: boolean;
};

export type Diary = { date: string; needs: Need[]; holes: Hole[]; people: PersonDay[]; done: boolean };

export type DiaryInput = {
  date: string;
  /** The department whose plan it is; null for every department together. */
  departmentId: string | null;
  /** The site's areas, each with its department and the area it is part of (Admin, Areas). */
  areas: readonly (NeedArea & { departmentId?: string | null; parentName?: string | null })[];
  /** The organisation's activity list. */
  types: readonly { id: string; name: string; departmentId: string; requiredTypeId: string | null; requiredName: string | null; fromClasses: boolean }[];
  /** Activities and bookings on the day (`bookingTitle` set for a booking). */
  needs: readonly { id: string; typeId: string; place: string; start: number; end: number; places: number; note: string; bookingTitle: string | null }[];
  /** People on activities and bookings, with the sub-activities they do there ("start", "end",
   *  "at" set times, or "during"). */
  assignments: readonly { id: string; needId: string; place: number; userId: string; start: number; end: number; subs?: readonly SubIn[] }[];
  /** People on an area's own need, by the need's id (`area:<area>:<qualification>:<date>`). */
  areaAssignments: readonly { id: string; needId: string; place: number; userId: string; start: number; end: number }[];
  classes: readonly { ref: string; title: string; place: string; start: number; end: number; userId: string | null }[];
  shifts: readonly { id: string; userId: string; departmentId: string; start: number; end: number }[];
  breaks: readonly { userId: string; start: number; minutes: number; paid: boolean }[];
  /** Everyone who may come into the day: name, departments, under-18 band. */
  staff: readonly { userId: string; name: string; departmentIds: readonly string[]; young: YoungBand | null }[];
  held: readonly Held[];
  /** Off that day (an absence). */
  off: ReadonlySet<string>;
  /** What people are on at other sites that day. */
  elsewhere: ReadonlyMap<string, readonly (Span & { label: string })[]>;
};

/** Off this long or longer between two stretches is a split shift, not free time. */
const SPLIT_AFTER = 60;
/** Free time shorter than this is a changeover, not time to give. */
const MIN_FREE = 10;

export const areaOf = (place: string) => place.split(",")[0].trim();
const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

/** Take spans away from a span. */
export function subtract(span: Span, taken: readonly Span[]): Span[] {
  let out: Span[] = [{ ...span }];
  for (const t of taken) out = out.flatMap((s) => (overlaps(s, t) ? [{ start: s.start, end: Math.max(s.start, t.start) }, { start: Math.min(s.end, t.end), end: s.end }] : [s]))
    .filter((s) => s.end > s.start);
  return out;
}

/** Spans joined where they overlap or are less than `gap` apart. */
export function joined(spans: readonly Span[], gap = 0): Span[] {
  const out: Span[] = [];
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && s.start - last.end < gap + (gap ? 0 : 1)) last.end = Math.max(last.end, s.end);
    else out.push({ start: s.start, end: s.end });
  }
  return out;
}

/** What the day needs, which department plans see it, and who is on what. */
function needsOf(input: DiaryInput): Need[] {
  const types = new Map(input.types.map((t) => [t.id, t]));
  const areaById = new Map(input.areas.map((a) => [a.id, a]));
  const groupOf = (name: string) => input.areas.find((a) => a.name.toLowerCase() === name.toLowerCase())?.parentName ?? "";
  const out: Need[] = [];
  const partsOf = (name: string) => [name, ...input.areas.filter((x) => x.parentName?.toLowerCase() === name.toLowerCase()).map((x) => x.name)].map((n) => n.toLowerCase());
  const own = areaNeedsOn(input.areas, input.date);
  const lineTypes = (areaId: string) => [...new Set(own.filter((n) => n.areaId === areaId && !n.activityTypeId).map((n) => n.qualificationTypeId))];
  for (const a of own) {
    const cuts = [...new Set([a.startMinutes, a.endMinutes, ...a.off.flatMap((o) => [o.start, o.end])])].filter((t) => t >= a.startMinutes && t <= a.endMinutes).sort((x, y) => x - y);
    const wants: Need["wants"] = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const s = { start: cuts[i], end: cuts[i + 1] };
      const count = a.places - new Set(a.off.filter((o) => o.start <= s.start && o.end >= s.end).map((o) => o.place)).size;
      const last = wants[wants.length - 1];
      if (last && last.end === s.start && last.count === count) last.end = s.end;
      else wants.push({ ...s, count });
    }
    const home = areaById.get(a.areaId);
    const activity = a.activityTypeId ? types.get(a.activityTypeId) : undefined;
    if (a.activityTypeId) {
      out.push({ key: a.id, kind: "area", title: activity?.name ?? a.activityName ?? "Activity", detail: null, area: a.areaName, group: home?.parentName ?? "", departmentId: home?.departmentId ?? null,
        start: a.startMinutes, end: a.endMinutes, wants: wants.filter((w) => w.count > 0), requiredTypeId: activity?.requiredTypeId ?? null, requiredName: activity?.requiredName ?? null,
        note: null, typeId: a.activityTypeId, needId: a.id, classRef: null, onActivity: { typeId: a.activityTypeId, areas: partsOf(a.areaName) } });
      continue;
    }
    out.push({ key: a.id, kind: "area", title: `${a.label ?? "Staff"} on duty`, detail: null, area: a.areaName, group: home?.parentName ?? "", departmentId: home?.departmentId ?? null, start: a.startMinutes, end: a.endMinutes,
      wants: wants.filter((w) => w.count > 0), requiredTypeId: a.qualificationTypeId, requiredName: a.typeName, note: a.together, typeId: null, needId: a.id, classRef: null, onActivity: null,
      coveredBy: { areas: partsOf(a.areaName), lines: lineTypes(a.areaId) } });
  }
  for (const n of input.needs) {
    const type = types.get(n.typeId);
    out.push({ key: n.id, kind: n.bookingTitle ? "booking" : "activity", title: n.bookingTitle ?? type?.name ?? "Activity", detail: n.bookingTitle ? type?.name ?? null : null,
      area: areaOf(n.place), group: groupOf(areaOf(n.place)), departmentId: type?.departmentId ?? null, start: n.start, end: n.end, wants: n.places > 0 ? [{ start: n.start, end: n.end, count: n.places }] : [],
      requiredTypeId: type?.requiredTypeId ?? null, requiredName: type?.requiredName ?? null, note: n.note || null, typeId: n.typeId, needId: n.id, classRef: null, onActivity: null });
  }
  const teaching = input.types.find((t) => t.fromClasses);
  for (const c of input.classes) {
    out.push({ key: `class:${c.ref}`, kind: "class", title: c.title, detail: "Swim class", area: areaOf(c.place), group: groupOf(areaOf(c.place)), departmentId: teaching?.departmentId ?? null, start: c.start, end: c.end,
      wants: [{ start: c.start, end: c.end, count: 1 }], requiredTypeId: teaching?.requiredTypeId ?? null, requiredName: teaching?.requiredName ?? null, note: null, typeId: null, needId: null, classRef: c.ref, onActivity: null });
  }
  return out.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
}

/** A sub-activity someone does: `at` its first set time, `times` all of them (owner, 21 October
 *  2026: cash drops at 12:00 and 16:00). One done any time ("during") has the time the Plan placed
 *  it at, or none yet (owner, 21 October 2026: "assigned at any time during that activity,
 *  directly on the plan"). */
export type SubIn = { id?: string; name: string; when: string; at: number | null; times?: readonly number[] };

/** Sub-activities on the clock: at the start, at the end, at each of their times, at the time the
 *  Plan placed one done any time, or not placed yet (null). */
export function subsAt(a: { start: number; end: number; subs?: readonly SubIn[] }): Line["subs"] {
  const at = (s: SubIn): (number | null)[] => (s.when === "start" ? [a.start] : s.when === "end" ? [a.end]
    : s.times?.length ? [...s.times] : [s.at]);
  return (a.subs ?? []).flatMap((s) => at(s).map((t) => ({ ...(s.id ? { id: s.id } : {}), name: s.name, when: s.when, at: t })))
    .sort((x, y) => (x.at ?? a.start + 0.5) - (y.at ?? a.start + 0.5));
}

function linesOf(input: DiaryInput, needs: readonly Need[]): Line[] {
  const byKey = new Map(needs.map((n) => [n.key, n]));
  const line = (n: Need | undefined, a: { id: string; userId: string; start: number; end: number; place: number | null; subs?: DiaryInput["assignments"][number]["subs"] }, assignmentId: string | null): Line[] =>
    n ? [{ key: `${n.key}|${a.id}`, userId: a.userId, needKey: n.key, kind: n.kind, title: n.title, typeId: n.kind === "activity" || n.kind === "booking" ? n.typeId : null, area: n.area, group: n.group,
      subs: subsAt(a), start: a.start, end: a.end, assignmentId, place: a.place, ...(n.kind === "activity" ? { requiredTypeId: n.requiredTypeId } : {}) }] : [];
  return [
    ...input.areaAssignments.flatMap((a) => line(byKey.get(a.needId), a, a.id)),
    ...input.assignments.flatMap((a) => line(byKey.get(a.needId), a, a.id)),
    ...input.classes.flatMap((c) => (c.userId ? line(byKey.get(`class:${c.ref}`), { id: c.ref, userId: c.userId, start: c.start, end: c.end, place: null }, null) : [])),
  ].sort((a, b) => a.start - b.start || a.end - b.end);
}

/** A stretch's paid time and unpaid break minutes, by the house rule for its length. */
export function partPay(part: Span, young: YoungBand | null) {
  const unpaid = breakEntitlement(part.end - part.start, young).filter((b) => !b.paid).reduce((m, b) => m + b.minutes, 0);
  return { paid: part.end - part.start - unpaid, unpaid };
}

/** One person's day: their stretches of work, breaks owed and placed, time not given yet, paid
 *  time and what to look at. */
function personDay(input: DiaryInput, person: DiaryInput["staff"][number], lines: readonly Line[], needs: ReadonlyMap<string, Need>): PersonDay {
  const shifts = input.shifts.filter((s) => s.userId === person.userId).map((s) => ({ id: s.id, departmentId: s.departmentId, start: s.start, end: s.end }));
  const parts = joined([...shifts, ...lines], SPLIT_AFTER);
  const placed = input.breaks.filter((b) => b.userId === person.userId).map((b) => ({ start: b.start, end: b.start + b.minutes, paid: b.paid }));
  const breaks: Break[] = [];
  const warnings: Warning[] = [];
  let paidMinutes = 0;
  for (const part of parts) {
    const owed = breakEntitlement(part.end - part.start, person.young);
    const here = placed.filter((b) => b.start >= part.start && b.start < part.end);
    breaks.push(...here.map((b) => ({ ...b, placed: true })));
    const unplaced = owed.slice(here.length);
    if (unplaced.length) warnings.push({ kind: "unplaced", minutes: unplaced.reduce((m, b) => m + b.minutes, 0) });
    paidMinutes += partPay(part, person.young).paid;
  }
  const free = parts.flatMap((p) => subtract(p, [...lines, ...breaks])).filter((s) => s.end - s.start >= MIN_FREE);
  const off = input.off.has(person.userId);
  if (off && lines.length) warnings.unshift({ kind: "off" });
  const away = input.elsewhere.get(person.userId) ?? [];
  for (const [i, l] of lines.entries()) {
    const clash = lines.slice(i + 1).find((m) => overlaps(l, m)) ?? null;
    if (clash) warnings.push({ kind: "overlap", with: `${clash.title} ${clock(clash.start)}–${clock(clash.end)}` });
    const elsewhere = away.find((w) => overlaps(l, w));
    if (elsewhere) warnings.push({ kind: "overlap", with: elsewhere.label });
    const need = needs.get(l.needKey);
    const q = need ? qualification(input.held, person.userId, need.requiredTypeId, input.date) : "ok";
    if (need && q !== "ok") warnings.push({ kind: "qualification", what: l.title, name: need.requiredName ?? "qualification", state: q });
    for (const b of breaks) if (overlaps(l, b)) warnings.push({ kind: "breakCover", what: l.title });
  }
  if (person.young && (lines.length || shifts.length)) warnings.push({ kind: "young" });
  return { userId: person.userId, name: person.name, departmentIds: [...person.departmentIds], lines: [...lines], parts, breaks: breaks.sort((a, b) => a.start - b.start), free, paidMinutes, shifts, warnings, off };
}

/** Does someone's line count for a need: theirs on it, or for an area's activity line, on that
 *  activity in the area or its parts. */
export const countsFor = (need: Need) => (l: Line) => l.needKey === need.key
  || (!!need.onActivity && !!l.typeId && l.typeId === need.onActivity.typeId && need.onActivity.areas.includes(l.area.toLowerCase()))
  || coversArea(need, l);

/** Does someone on an activity count for an area's staff needed: the activity is in the area or
 *  one of its parts, and its qualification is the line's (or, when no line asks for it, the line
 *  asks for none). */
function coversArea(need: Need, l: Pick<Line, "kind" | "area" | "requiredTypeId">) {
  if (!need.coveredBy || l.kind !== "activity" || !need.coveredBy.areas.includes(l.area.toLowerCase())) return false;
  const asks = l.requiredTypeId ?? null;
  return asks && need.coveredBy.lines.includes(asks) ? need.requiredTypeId === asks : need.requiredTypeId === null;
}

/** The activities that cover an area's staff needed when someone is put on one there (owner, 21
 *  October 2026: choosing someone for Reception's gap puts them on a Reception activity): the area's
 *  department's activities whose qualification fits the line, those already on in the area that
 *  day first. None for any other need. */
export function coverActivities<T extends { id: string; departmentId: string; requiredTypeId: string | null }>(need: Need, activities: readonly T[], lines: readonly Line[]): T[] {
  if (!need.coveredBy || need.kind !== "area") return [];
  const fits = activities.filter((a) => (!need.departmentId || a.departmentId === need.departmentId)
    && coversArea(need, { kind: "activity", area: need.area, requiredTypeId: a.requiredTypeId }));
  const used = new Set(lines.filter((l) => l.kind === "activity" && l.typeId && need.coveredBy!.areas.includes(l.area.toLowerCase())).map((l) => l.typeId));
  return [...fits.filter((a) => used.has(a.id)), ...fits.filter((a) => !used.has(a.id))];
}

/** Is a need only a place to hold people for an area (it asks for nobody itself, and who is on it
 *  counts for the area's activity line or staff needed)? It is then read under the area. */
export const heldByAreaLine = (need: Need, needs: readonly Need[]) => need.kind === "activity" && !need.wants.length
  && needs.some((n) => (n.onActivity && n.onActivity.typeId === need.typeId && n.onActivity.areas.includes(need.area.toLowerCase()))
    || coversArea(n, { kind: "activity", area: need.area, requiredTypeId: need.requiredTypeId }));

/** Holes in one need: where fewer people are on it than it needs, counting nobody who is off or
 *  on a break. */
function holesOf(need: Need, lines: readonly Line[], people: ReadonlyMap<string, PersonDay>): Hole[] {
  const on = lines.filter(countsFor(need));
  const breaks = on.flatMap((l) => (people.get(l.userId)?.breaks ?? []).filter((b) => overlaps(b, l)).map((b) => ({ ...b, userId: l.userId })));
  const cuts = [...new Set([...need.wants.flatMap((w) => [w.start, w.end]), ...on.flatMap((l) => [l.start, l.end]), ...breaks.flatMap((b) => [b.start, b.end])])]
    .filter((t) => t >= need.start && t <= need.end).sort((a, b) => a - b);
  const out: Hole[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const s = { start: cuts[i], end: cuts[i + 1] };
    const want = need.wants.find((w) => w.start <= s.start && w.end >= s.end)?.count ?? 0;
    if (!want) continue;
    const here = on.filter((l) => l.start <= s.start && l.end >= s.end);
    const offNow = here.filter((l) => people.get(l.userId)?.off);
    const resting = here.filter((l) => !people.get(l.userId)?.off && breaks.some((b) => b.userId === l.userId && b.start <= s.start && b.end >= s.end));
    const have = here.length - offNow.length - resting.length;
    const short = want - have;
    if (short <= 0) continue;
    const first = (l: Line) => people.get(l.userId)?.name.split(" ")[0] ?? "Someone";
    const it = need.onActivity ? " on it" : "";
    const why = offNow.length ? `${first(offNow[0])} is off` : resting.length ? `${first(resting[0])} is on a break`
      : have === 0 ? (want === 1 ? `Nobody${it} yet` : `Needs ${want}${it}, nobody yet`) : `${short} more needed${it}`;
    const last = out[out.length - 1];
    if (last && last.end === s.start && last.short === short && last.why === why) last.end = s.end;
    else out.push({ key: `${need.key}|${s.start}`, needKey: need.key, start: s.start, end: s.end, short, empty: have <= 0, why });
  }
  return out;
}

/** Does this department's plan show this need? Its own work always, and its own areas' needs
 *  (Admin, Areas); a shared area's need when the department's people can do it (someone in it
 *  holds the qualification, or none is needed); every department's when the plan shows them all. */
function shownOn(need: Need, input: DiaryInput, members: readonly DiaryInput["staff"][number][]) {
  if (!input.departmentId) return true;
  if (need.departmentId) return need.departmentId === input.departmentId;
  if (!need.requiredTypeId) return true;
  return members.some((m) => qualification(input.held, m.userId, need.requiredTypeId, input.date) === "ok");
}

export function buildDiary(input: DiaryInput): Diary {
  const all = needsOf(input);
  const allLines = linesOf(input, all);
  const byKey = new Map(all.map((n) => [n.key, n]));
  const members = input.departmentId ? input.staff.filter((s) => s.departmentIds.includes(input.departmentId!)) : input.staff;
  const needs = all.filter((n) => shownOn(n, input, members));
  const shownKeys = new Set(needs.map((n) => n.key));
  // On this plan: anyone on a shift in the department or on its work, and its own people working here.
  const onPlan = (s: DiaryInput["staff"][number]) => {
    if (!input.departmentId) return allLines.some((l) => l.userId === s.userId) || input.shifts.some((x) => x.userId === s.userId);
    return input.shifts.some((x) => x.userId === s.userId && x.departmentId === input.departmentId)
      || allLines.some((l) => l.userId === s.userId && byKey.get(l.needKey)?.departmentId === input.departmentId)
      || (s.departmentIds.includes(input.departmentId) && (allLines.some((l) => l.userId === s.userId) || input.shifts.some((x) => x.userId === s.userId)));
  };
  const everyone = new Map(input.staff.map((s) => [s.userId, personDay(input, s, allLines.filter((l) => l.userId === s.userId), byKey)]));
  const people = input.staff.filter(onPlan).map((s) => everyone.get(s.userId)!)
    .sort((a, b) => (a.parts[0]?.start ?? 1440) - (b.parts[0]?.start ?? 1440) || a.name.localeCompare(b.name));
  // An area's activity line and staff needed count everyone on an activity there, shown on this plan or not.
  const holes = needs.flatMap((n) => holesOf(n, n.onActivity || n.coveredBy ? allLines : allLines.filter((l) => shownKeys.has(l.needKey)), everyone)).sort((a, b) => a.start - b.start || a.end - b.end);
  return { date: input.date, needs, holes, people, done: holes.length === 0 };
}

/* ---------- Reading the day ---------- */

/** Who is on each need at one moment, and how many more it needs then: "who's where at 14:30?". */
export type WhereAt = { need: Need; names: string[]; short: number };
export function whoIsWhere(diary: Diary, at: number): WhereAt[] {
  return diary.needs.flatMap((need) => {
    if (heldByAreaLine(need, diary.needs)) return [];
    const running = need.start <= at && at < need.end;
    const counts = countsFor(need);
    const holding = diary.people.flatMap((p) => p.lines.filter((l) => counts(l) && l.start <= at && at < l.end && !p.off && !p.breaks.some((b) => b.start <= at && at < b.end)).map(() => p.name));
    if (!running && !holding.length) return [];
    const short = diary.holes.filter((h) => h.needKey === need.key && h.start <= at && at < h.end).reduce((n, h) => n + h.short, 0);
    return [{ need, names: [...new Set(holding)], short }];
  });
}

/** The next moment after `at` someone starts, finishes, goes on a break or moves on, and who. */
export type Change = { at: number; starts: string[]; finishes: string[]; breaks: string[]; moves: { name: string; to: string }[] };
export function nextChange(diary: Diary, at: number): Change | null {
  const times = diary.people.flatMap((p) => [...p.parts.flatMap((x) => [x.start, x.end]), ...p.breaks.map((b) => b.start), ...p.lines.map((l) => l.start)]).filter((t) => t > at);
  if (!times.length) return null;
  const next = Math.min(...times);
  const change: Change = { at: next, starts: [], finishes: [], breaks: [], moves: [] };
  for (const p of diary.people) {
    if (p.parts.some((x) => x.start === next)) change.starts.push(p.name);
    else if (p.parts.some((x) => x.end === next)) change.finishes.push(p.name);
    else if (p.breaks.some((b) => b.start === next)) change.breaks.push(p.name);
    else {
      const to = p.lines.find((l) => l.start === next && !p.lines.some((m) => m !== l && m.needKey === l.needKey && m.end <= next && m.end >= next - 5));
      const from = p.lines.find((l) => l.end === next && to && l.kind === "class" && to.kind === "class");
      if (to && !from) change.moves.push({ name: p.name, to: to.kind === "area" ? to.area : to.title });
    }
  }
  return change.starts.length || change.finishes.length || change.breaks.length || change.moves.length ? change : nextChange(diary, next);
}

/** One person's day top to bottom, like a diary page: what they are on, breaks, time not given
 *  yet, time off between split stretches, then when they finish. Back-to-back swim classes five
 *  minutes apart or less are one line. */
export type Step =
  | (Span & { kind: "work"; line: Line; count: number })
  | (Span & { kind: "break"; paid: boolean })
  | (Span & { kind: "free" | "off" | "finish" });
export function stepsOf(p: PersonDay): Step[] {
  const work: Extract<Step, { kind: "work" }>[] = [];
  for (const l of p.lines) {
    const last = work[work.length - 1];
    if (last && last.line.kind === "class" && l.kind === "class" && last.line.area === l.area && l.start >= last.end && l.start - last.end <= 5) { last.end = l.end; last.count += 1; }
    else work.push({ kind: "work", start: l.start, end: l.end, line: l, count: 1 });
  }
  if (!p.parts.length) return [];
  const steps: Step[] = [
    ...work,
    ...p.breaks.map((b) => ({ kind: "break" as const, start: b.start, end: b.end, paid: b.paid })),
    ...p.free.map((s) => ({ kind: "free" as const, ...s })),
    ...p.parts.slice(1).map((x, i) => ({ kind: "off" as const, start: p.parts[i].end, end: x.start })),
  ].sort((a, b) => a.start - b.start || a.end - b.end);
  const end = p.parts[p.parts.length - 1].end;
  return [...steps, { kind: "finish", start: end, end }];
}

/* ---------- Who could fill a hole ---------- */

export type Candidate = {
  userId: string;
  name: string;
  /** In the plan's department, or lent from another. */
  own: boolean;
  ok: boolean;
  /** Why not, when not: "Off today", "Busy: Main pool 12:00–15:00", "Needs NPLQ". */
  why: string | null;
  /** What taking it does to their day: "On shift then", "Their day becomes 07:00–16:00", "Not in today: a new shift". */
  effect: string;
  extraMinutes: number;
  weekMinutes: number;
  contractMinutes: number | null;
};

/** Everyone who could take `span` of a need, best first: free and qualified before not; the
 *  department's own people before others; then those already on shift then, those whose day
 *  grows least, and those with the fewest hours that week against their contract. */
export function candidates(diary: Diary, input: Pick<DiaryInput, "staff" | "held" | "off" | "elsewhere" | "departmentId" | "date">, need: Need, span: Span,
  hours: ReadonlyMap<string, { week: number; contract: number | null }>): Candidate[] {
  const days = new Map(diary.people.map((p) => [p.userId, p]));
  const out = input.staff.map((s): Candidate => {
    const day = days.get(s.userId);
    const own = !input.departmentId || s.departmentIds.includes(input.departmentId);
    const h = hours.get(s.userId) ?? { week: 0, contract: null };
    const base = { userId: s.userId, name: s.name, own, weekMinutes: h.week, contractMinutes: h.contract };
    if (input.off.has(s.userId)) return { ...base, ok: false, why: "Off today", effect: "", extraMinutes: 0 };
    const busy = [...(day?.lines ?? []).filter((l) => l.needKey !== need.key).map((l) => ({ ...l, label: `${l.kind === "area" ? l.area : l.title} ${clock(l.start)}–${clock(l.end)}` })),
      ...(input.elsewhere.get(s.userId) ?? [])].find((w) => overlaps(w, span));
    if (busy) return { ...base, ok: false, why: `Busy: ${busy.label}`, effect: "", extraMinutes: 0 };
    if (day?.lines.some((l) => l.needKey === need.key && overlaps(l, span))) return { ...base, ok: false, why: "Already on it then", effect: "", extraMinutes: 0 };
    const q = qualification(input.held, s.userId, need.requiredTypeId, input.date);
    if (q !== "ok") return { ...base, ok: false, why: q === "expired" ? `${need.requiredName ?? "Qualification"} expired` : `Needs ${need.requiredName ?? "a qualification"}`, effect: "", extraMinutes: 0 };
    const parts = day?.parts ?? [];
    const within = parts.some((p) => p.start <= span.start && p.end >= span.end);
    const after = joined([...parts, span], SPLIT_AFTER);
    const before = parts.reduce((m, p) => m + p.end - p.start, 0);
    const extra = after.reduce((m, p) => m + p.end - p.start, 0) - before;
    const grown = after.find((p) => p.start <= span.start && p.end >= span.end)!;
    const apart = grown.start === span.start && grown.end === span.end;
    const effect = within ? "On shift then" : !parts.length ? `Not in today: a shift ${clock(span.start)}–${clock(span.end)}`
      : apart ? `A split day: in ${clock(span.start)}–${clock(span.end)} as well` : `Their day becomes ${clock(grown.start)}–${clock(grown.end)}`;
    const onBreak = day?.breaks.some((b) => overlaps(b, span));
    return { ...base, ok: true, why: onBreak ? "Their break is then: move it" : null, effect, extraMinutes: extra };
  });
  const load = (c: Candidate) => (c.contractMinutes ? (c.weekMinutes + c.extraMinutes) / c.contractMinutes : 1 + c.weekMinutes / 6000);
  return out.sort((a, b) => Number(b.ok) - Number(a.ok) || Number(b.own) - Number(a.own) || Number(!!a.why) - Number(!!b.why)
    || a.extraMinutes - b.extraMinutes || load(a) - load(b) || a.name.localeCompare(b.name));
}
