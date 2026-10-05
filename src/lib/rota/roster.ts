import { clock, isPaidBreak, type RotaWarning } from "@/lib/rota/constants";

/** The week plan as a roster sheet (owner decision, 3 October 2026: the duty
 *  grid was "extremely confusing to use, to read and not practical"): one row
 *  per person, grouped by the department they work most that week, a cell per
 *  day saying when and what they mainly do, their paid hours at the end. What
 *  still needs someone (unfilled duties, booking places, cover for someone
 *  off) sits in a "To fill" row above everyone. A department's staff with no
 *  shift that week still get a row (owner decision, 5 October 2026: supervisors
 *  plan everyone in their department), and `forDepartment` narrows the sheet to
 *  one department. Pure and tested; the page loads the week and the roster
 *  component draws it. */

export type RosterShift = {
  id: string;
  kind: string;
  startMinutes: number;
  endMinutes: number;
  role: string;
  importId: string | null;
  userId: string | null;
  rotaPersonId: string | null;
  departmentId: string | null;
  user: { name: string } | null;
  rotaPerson: { name: string } | null;
  department: { name: string; sortOrder: number } | null;
  bookingNeed?: { role: string } | null;
  segments: { startMinutes: number; endMinutes: number; kind: string; label: string }[];
  warnings: RotaWarning[];
};

export type RosterCell = {
  id: string;
  /** "07:00–15:00". */
  time: string;
  /** Minutes after midnight. */
  start: number;
  end: number;
  /** What they mainly do: their activities in order, else the duty. */
  what: string;
  absent: boolean;
  /** Qualification, double-booking and teaching warnings. */
  warnings: RotaWarning[];
  /** Planned in Turnfin, so it can be changed here. */
  editable: boolean;
  departmentId: string | null;
};
export type RosterPerson = { key: string; userId: string | null; name: string; days: RosterCell[][]; minutes: number };
export type RosterGroup = { key: string; label: string; people: RosterPerson[] };
/** Something that needs a person: an unfilled duty, a booking place, or cover for someone off. */
export type RosterFill = {
  id: string;
  /** In full, "Lifeguard: Example NS", for the spoken label and the agenda. */
  what: string;
  /** The role alone, "Lifeguard", for a block in a day column. */
  role: string;
  time: string; start: number; end: number; cover: string | null;
  departmentId: string | null;
};
/** Someone in a department, from the site's department lists. */
export type RosterMember = { userId: string; name: string; departmentId: string; primary: boolean };

const NO_DEPARTMENT = "No department";
const span = (s: { startMinutes: number; endMinutes: number }) => `${clock(s.startMinutes)}–${clock(s.endMinutes)}`;

/** What a shift is mostly about, in a few words: "25m pool, lessons". */
function mainly(s: RosterShift) {
  const activities = [...new Set(s.segments.filter((g) => g.kind === "activity").map((g) => g.label.trim()).filter(Boolean))];
  const duty = s.bookingNeed?.role ? `${s.bookingNeed.role}, ${s.role.replace(/^[^:]+:\s*/, "")}` : s.role;
  return activities.length ? activities.slice(0, 2).join(", ") + (activities.length > 2 ? "…" : "") : duty;
}

/** Paid minutes: the shift less its unpaid breaks. */
const paid = (s: RosterShift) => s.endMinutes - s.startMinutes - s.segments.filter((g) => g.kind === "break" && !isPaidBreak(g)).reduce((m, g) => m + g.endMinutes - g.startMinutes, 0);

export function buildRoster(days: readonly { iso: string; shifts: readonly RosterShift[] }[], members: readonly RosterMember[] = [], departments: readonly { id: string; name: string }[] = []) {
  type Person = { key: string; userId: string | null; name: string; entries: { day: number; s: RosterShift }[] };
  const people = new Map<string, Person>();
  const fill: RosterFill[][] = days.map(() => []);
  days.forEach((d, day) => {
    for (const s of d.shifts) {
      if (s.kind !== "shift") continue;
      const key = s.userId ? `u:${s.userId}` : s.rotaPersonId ? `p:${s.rotaPersonId}` : null;
      const what = s.bookingNeed?.role ? `${s.bookingNeed.role}: ${s.role.replace(/^[^:]+:\s*/, "")}` : s.role;
      const role = (s.bookingNeed?.role ?? s.role).trim();
      const at = { id: s.id, what, role, time: span(s), start: s.startMinutes, end: s.endMinutes, departmentId: s.departmentId };
      if (!key) { fill[day].push({ ...at, cover: null }); continue; }
      const name = s.user?.name ?? s.rotaPerson?.name ?? "Someone";
      if (s.warnings.includes("absent")) fill[day].push({ ...at, cover: name });
      const person = people.get(key) ?? { key, userId: s.userId, name, entries: [] };
      person.entries.push({ day, s });
      people.set(key, person);
    }
  });

  // Each person sits in the department they work most this week.
  const groups = new Map<string, { key: string; label: string; order: number; people: RosterPerson[] }>();
  for (const p of people.values()) {
    const time = new Map<string, { minutes: number; order: number; id: string }>();
    for (const { s } of p.entries) {
      const label = s.department?.name ?? NO_DEPARTMENT;
      const t = time.get(label) ?? { minutes: 0, order: s.department?.sortOrder ?? Number.MAX_SAFE_INTEGER, id: s.departmentId ?? "none" };
      t.minutes += s.endMinutes - s.startMinutes;
      time.set(label, t);
    }
    const [label, { order, id }] = [...time].sort((a, b) => b[1].minutes - a[1].minutes || a[0].localeCompare(b[0]))[0];
    const g = groups.get(label) ?? { key: `g:${id}`, label, order, people: [] };
    const cells: RosterCell[][] = days.map(() => []);
    for (const { day, s } of [...p.entries].sort((a, b) => a.s.startMinutes - b.s.startMinutes)) {
      cells[day].push({ id: s.id, time: span(s), start: s.startMinutes, end: s.endMinutes, what: mainly(s), absent: s.warnings.includes("absent"),
        warnings: s.warnings.filter((w) => w !== "absent" && w !== "open"), editable: !s.importId, departmentId: s.departmentId });
    }
    g.people.push({ key: p.key, userId: p.userId, name: p.name, days: cells,
      minutes: p.entries.filter(({ s }) => !s.warnings.includes("absent")).reduce((m, { s }) => m + paid(s), 0) });
    groups.set(label, g);
  }
  // A department's staff with nothing this week: a row of free days in their main department.
  const order = new Map(departments.map((d, i) => [d.id, i]));
  const placed = new Set([...people.values()].flatMap((p) => (p.userId ? [p.userId] : [])));
  for (const m of [...members].sort((a, b) => Number(b.primary) - Number(a.primary))) {
    const dept = departments.find((d) => d.id === m.departmentId);
    if (placed.has(m.userId) || !dept) continue;
    placed.add(m.userId);
    const g = groups.get(dept.name) ?? { key: `g:${dept.id}`, label: dept.name, order: order.get(dept.id) ?? Number.MAX_SAFE_INTEGER, people: [] };
    g.people.push({ key: `u:${m.userId}`, userId: m.userId, name: m.name, days: days.map(() => []), minutes: 0 });
    groups.set(dept.name, g);
  }
  const sorted = [...groups.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map(({ key, label, people: list }) => ({ key, label, people: list.sort((a, b) => a.name.localeCompare(b.name)) }));

  return { groups: sorted, fill, tiles: tilesOf(sorted, fill) };
}
export type RosterData = ReturnType<typeof buildRoster>;

function tilesOf(groups: readonly RosterGroup[], fill: readonly RosterFill[][]) {
  const all = groups.flatMap((g) => g.people);
  return {
    people: all.length,
    minutes: all.reduce((m, p) => m + p.minutes, 0),
    toFill: fill.reduce((n, list) => n + list.length, 0),
    offPeople: all.filter((p) => p.days.flat().some((c) => c.absent)).length,
    offShifts: all.flatMap((p) => p.days.flat()).filter((c) => c.absent).length,
    warnings: all.flatMap((p) => p.days.flat()).filter((c) => !c.absent && c.warnings.length).length,
  };
}

/** One department's week: everyone in it (by the department lists or a shift in it that week),
 *  with all their shifts, so a supervisor sees when they are busy elsewhere, and only its
 *  shifts still to fill. */
export function forDepartment(roster: RosterData, departmentId: string, members: readonly RosterMember[], label: string): RosterData {
  const inIt = new Set(members.filter((m) => m.departmentId === departmentId).map((m) => m.userId));
  const people = roster.groups.flatMap((g) => g.people)
    .filter((p) => (p.userId && inIt.has(p.userId)) || p.days.flat().some((c) => c.departmentId === departmentId))
    .sort((a, b) => a.name.localeCompare(b.name));
  const groups = people.length ? [{ key: `g:${departmentId}`, label, people }] : [];
  const fill = roster.fill.map((list) => list.filter((f) => f.departmentId === departmentId));
  return { groups, fill, tiles: tilesOf(groups, fill) };
}
