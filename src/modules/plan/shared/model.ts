/** Plan (test)'s day, worked out from scratch and pure (model.test.ts), with the owner's rules of
 *  29 October 2026:
 *  - A shift is built first: a person at a site on a day. Duty blocks fill it.
 *  - Sessions are what's on. Each needs duties × count for the whole time it runs; sessions on the
 *    same area stack, so their needs add up (a booking adds its own extra lifeguard).
 *  - A gap is a needed place nobody's block fills, stretch by stretch. A break never fills one.
 *  - Swim classes (and other commitments) need one place on the class duty, filled by whoever the
 *    source says teaches it.
 *  - Warnings never block. */

export type Span = { start: number; end: number };

export type SessionDef = {
  id: string;
  title: string;
  areaId: string | null;
  lanes: number[];
  start: number;
  end: number;
  /** Monday = 0. */
  weekdays: number[];
  firstDay: string;
  lastDay: string;
  skipDays: string[];
  needs: { dutyId: string; count: number }[];
  /** Single days changed or called off. */
  days: { date: string; cancelled: boolean; start: number | null; end: number | null }[];
};

export type Occurrence = { sessionId: string; title: string; areaId: string | null; lanes: number[]; start: number; end: number; needs: { dutyId: string; count: number }[] };

/** A class (or other commitment) on the day, from its own app. */
export type ClassItem = { ref: string; source: string; title: string; place: string; start: number; end: number; userId: string | null; plannable: boolean };

export type Need = {
  key: string;
  kind: "session" | "class";
  sessionId: string | null;
  classRef: string | null;
  source: string | null;
  title: string;
  areaId: string | null;
  start: number;
  end: number;
  dutyId: string;
  count: number;
};

export type Block = { id: string; shiftId: string; dutyId: string; sessionId: string | null; start: number; end: number };
export type Shift = { id: string; userId: string; departmentId: string; siteId: string; date: string; start: number; end: number; blocks: Block[] };

export type DutyRef = { id: string; name: string; qualificationTypeId: string | null; isBreak: boolean; departmentId: string | null };

/** Monday = 0 for an ISO day. */
export function weekdayOfIso(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** The ISO day `n` days after `iso`. */
export function shiftIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The Monday of the week `iso` falls in. */
export function mondayOf(iso: string): string {
  return shiftIso(iso, -weekdayOfIso(iso));
}

/** The sessions on a day, with that day's own times. */
export function occurrencesOn(sessions: readonly SessionDef[], date: string): Occurrence[] {
  const weekday = weekdayOfIso(date);
  const out: Occurrence[] = [];
  for (const s of sessions) {
    if (date < s.firstDay || date > s.lastDay || !s.weekdays.includes(weekday) || s.skipDays.includes(date)) continue;
    const day = s.days.find((d) => d.date === date);
    if (day?.cancelled) continue;
    out.push({ sessionId: s.id, title: s.title, areaId: s.areaId, lanes: s.lanes, start: day?.start ?? s.start, end: day?.end ?? s.end, needs: s.needs });
  }
  return out.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
}

/** Everything on the day that needs people: one need per session duty line, one per class. Classes
 *  sit in the area whose name matches their place (any case), else in none. */
export function needsOf(occurrences: readonly Occurrence[], classes: readonly ClassItem[], classDutyId: string | null, areas: readonly { id: string; name: string }[]): Need[] {
  const needs: Need[] = occurrences.flatMap((o) => o.needs.filter((n) => n.count > 0).map((n) => ({
    key: `s:${o.sessionId}:${n.dutyId}`, kind: "session" as const, sessionId: o.sessionId, classRef: null, source: null,
    title: o.title, areaId: o.areaId, start: o.start, end: o.end, dutyId: n.dutyId, count: n.count,
  })));
  if (classDutyId) {
    const byName = new Map(areas.map((a) => [a.name.trim().toLowerCase(), a.id]));
    for (const c of classes) needs.push({
      key: `c:${c.source}:${c.ref}`, kind: "class", sessionId: null, classRef: c.ref, source: c.source, title: c.title,
      areaId: byName.get(c.place.trim().toLowerCase()) ?? null, start: c.start, end: c.end, dutyId: classDutyId, count: 1,
    });
  }
  return needs;
}

/** Who fills a need: the blocks on that session and duty, or a class's teacher for its whole time. */
export function fillsOf(need: Need, blocks: readonly Block[], classes: readonly ClassItem[]): (Span & { userId?: string; blockId?: string })[] {
  if (need.kind === "class") {
    const c = classes.find((x) => `c:${x.source}:${x.ref}` === need.key);
    return c?.userId ? [{ start: need.start, end: need.end, userId: c.userId }] : [];
  }
  return blocks.filter((b) => b.sessionId === need.sessionId && b.dutyId === need.dutyId)
    .map((b) => ({ start: Math.max(b.start, need.start), end: Math.min(b.end, need.end), blockId: b.id }))
    .filter((s) => s.end > s.start);
}

/** The stretches of a need short of people, and by how many, joined where the shortfall holds. */
export function gapsOf(need: Need, fills: readonly Span[]): (Span & { short: number })[] {
  const points = [...new Set([need.start, need.end, ...fills.flatMap((f) => [f.start, f.end])])]
    .filter((p) => p >= need.start && p <= need.end).sort((a, b) => a - b);
  const out: (Span & { short: number })[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [start, end] = [points[i], points[i + 1]];
    const on = fills.filter((f) => f.start <= start && f.end >= end).length;
    const short = need.count - on;
    if (short <= 0) continue;
    const last = out[out.length - 1];
    if (last && last.end === start && last.short === short) last.end = end;
    else out.push({ start, end, short });
  }
  return out;
}

/** The breaks a shift of this length is owed (staff handbook, as the old Rota counts them). */
export function breakMinutesOwed(shiftMinutes: number): number {
  const h = shiftMinutes / 60;
  return h <= 4 ? 0 : h < 6 ? 15 : h < 8 ? 45 : h <= 10 ? 60 : 75;
}

/** Swim school's classes, the commitments the class duty's qualification is checked for. */
export const SWIM_CLASSES = "activities.classes";

export type Warning = { shiftId: string; kind: "qualification" | "overlap" | "outside" | "off" | "class" | "break"; text: string };

const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

/** What to warn about on each shift of a day. `held` says whether a person holds a qualification on
 *  the day; `off` is who is marked off; `classes` are every class that day, any site, by teacher;
 *  `elsewhere` their shifts at other sites that day. */
export function warningsOf(input: {
  shifts: readonly Shift[];
  duties: ReadonlyMap<string, DutyRef>;
  qualificationNames: ReadonlyMap<string, string>;
  held: (userId: string, typeId: string) => boolean;
  off: ReadonlySet<string>;
  classes: readonly ClassItem[];
  elsewhere: readonly Shift[];
  /** The duty classes need, for its qualification. */
  classDutyId?: string | null;
}): Warning[] {
  const classDuty = input.classDutyId ? input.duties.get(input.classDutyId) : undefined;
  const out: Warning[] = [];
  for (const s of input.shifts) {
    const say = (kind: Warning["kind"], text: string) => out.push({ shiftId: s.id, kind, text });
    if (input.off.has(s.userId)) say("off", "Marked off this day.");
    const others = [...input.shifts.filter((o) => o.id !== s.id && o.userId === s.userId), ...input.elsewhere.filter((o) => o.userId === s.userId)];
    if (others.some((o) => overlaps(o, s))) say("overlap", "On another shift at the same time.");
    const blocks = [...s.blocks].sort((a, b) => a.start - b.start);
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const duty = input.duties.get(b.dutyId);
      const name = duty?.name ?? "A duty";
      if (b.start < s.start || b.end > s.end) say("outside", `${name} ${clock(b.start)}–${clock(b.end)} runs outside the shift.`);
      if (blocks.slice(i + 1).some((o) => overlaps(o, b))) say("overlap", `${name} ${clock(b.start)}–${clock(b.end)} overlaps another duty.`);
      if (duty?.qualificationTypeId && !duty.isBreak && !input.held(s.userId, duty.qualificationTypeId))
        say("qualification", `${name} needs ${input.qualificationNames.get(duty.qualificationTypeId) ?? "a qualification"}, not held on the day.`);
    }
    for (const c of input.classes.filter((x) => x.userId === s.userId)) {
      // Only Swim school's own classes: an Academy course has its own trainers' rules.
      if (c.source === SWIM_CLASSES && classDuty?.qualificationTypeId && overlaps(c, s) && !input.held(s.userId, classDuty.qualificationTypeId))
        say("qualification", `Teaching ${c.title} needs ${input.qualificationNames.get(classDuty.qualificationTypeId) ?? "a qualification"}, not held on the day.`);
      if (blocks.some((b) => overlaps(b, c))) say("class", `Teaching ${c.title} ${clock(c.start)}–${clock(c.end)} during another duty.`);
      else if (overlaps(c, s) && (c.start < s.start || c.end > s.end)) say("class", `Teaching ${c.title} ${clock(c.start)}–${clock(c.end)}, past the shift's times.`);
    }
    const owed = breakMinutesOwed(s.end - s.start);
    const placed = blocks.filter((b) => input.duties.get(b.dutyId)?.isBreak).reduce((m, b) => m + (b.end - b.start), 0);
    if (owed > placed) say("break", `Owed ${owed} minutes of breaks; ${placed ? `${placed} placed` : "none placed"}.`);
  }
  return out;
}

/** Lanes taken twice at once: two sessions on the same area whose lanes meet (no lanes = all). */
export function laneClashes(occurrences: readonly Occurrence[], laneCount: ReadonlyMap<string, number>): { a: string; b: string; text: string }[] {
  const out: { a: string; b: string; text: string }[] = [];
  const lanesOf = (o: Occurrence) => o.lanes.length ? o.lanes : Array.from({ length: laneCount.get(o.areaId ?? "") ?? 0 }, (_, i) => i + 1);
  for (let i = 0; i < occurrences.length; i++) for (let j = i + 1; j < occurrences.length; j++) {
    const [a, b] = [occurrences[i], occurrences[j]];
    if (!a.areaId || a.areaId !== b.areaId || !(laneCount.get(a.areaId) ?? 0) || !overlaps(a, b)) continue;
    // Taking the whole area is the usual "Pool open": it only clashes with lanes when both name them.
    if (!a.lanes.length || !b.lanes.length) continue;
    const both = lanesOf(a).filter((l) => lanesOf(b).includes(l));
    if (both.length) out.push({ a: a.sessionId, b: b.sessionId, text: `${a.title} and ${b.title} both take lane${both.length > 1 ? "s" : ""} ${both.join(", ")}.` });
  }
  return out;
}

/** The tasks a block brings, at their times. A task at a set time belongs to the block running
 *  then, so one ending at 12:00 leaves a 12:00 task to the block starting at 12:00. */
export function tasksOf(block: Span, tasks: readonly { name: string; when: string; atMinutes: number | null }[]): { name: string; at: number }[] {
  return tasks.flatMap((t) => {
    if (t.when === "start") return [{ name: t.name, at: block.start }];
    if (t.when === "end") return [{ name: t.name, at: block.end }];
    return t.atMinutes !== null && t.atMinutes >= block.start && t.atMinutes < block.end ? [{ name: t.name, at: t.atMinutes }] : [];
  }).sort((a, b) => a.at - b.at);
}

export type Candidate = Span & { shiftId: string; userId: string; qualified: boolean; ownDepartment: boolean; free: boolean; whole: boolean };

/** Who could fill a stretch: everyone whose shift is on for some of it, offered for the part they
 *  are there (a long gap is filled by several people). Best first: qualified, free then, there for
 *  all of it, the department's own, then there longest. */
export function candidatesFor(span: Span, dutyId: string, input: {
  shifts: readonly Shift[]; duties: ReadonlyMap<string, DutyRef>; held: (userId: string, typeId: string) => boolean; departmentOf: (userId: string) => string[];
}): Candidate[] {
  const duty = input.duties.get(dutyId);
  return input.shifts.filter((s) => overlaps(s, span)).map((s) => {
    const part = { start: Math.max(s.start, span.start), end: Math.min(s.end, span.end) };
    return {
      ...part, shiftId: s.id, userId: s.userId,
      qualified: !duty?.qualificationTypeId || input.held(s.userId, duty.qualificationTypeId),
      ownDepartment: input.departmentOf(s.userId).includes(s.departmentId),
      free: !s.blocks.some((b) => overlaps(b, part)),
      whole: part.start === span.start && part.end === span.end,
    };
  }).sort((a, b) => Number(b.qualified) - Number(a.qualified) || Number(b.free) - Number(a.free) || Number(b.whole) - Number(a.whole)
    || Number(b.ownDepartment) - Number(a.ownDepartment) || (b.end - b.start) - (a.end - a.start));
}

/** Last week copied to this one: each shift a week on, with its blocks (session fills only where
 *  that session runs on the new day), skipping people marked off and anyone who already has a shift
 *  on the plan that day. */
export function copyWeek<S extends Shift>(last: readonly S[], input: { existing: readonly { userId: string; date: string }[]; offOn: (userId: string, date: string) => boolean; runsOn: (sessionId: string, date: string) => boolean }) {
  const taken = new Set(input.existing.map((e) => `${e.userId}|${e.date}`));
  return last.flatMap((s) => {
    const date = shiftIso(s.date, 7);
    if (taken.has(`${s.userId}|${date}`) || input.offOn(s.userId, date)) return [];
    taken.add(`${s.userId}|${date}`);
    return [{ ...s, date, blocks: s.blocks.filter((b) => !b.sessionId || input.runsOn(b.sessionId, date)) }];
  });
}
