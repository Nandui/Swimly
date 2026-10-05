import { clock, isPaidBreak, type RotaWarning } from "@/lib/rota/constants";

/** The week plan as a roster sheet (owner decision, 3 October 2026: the duty
 *  grid was "extremely confusing to use, to read and not practical"): one row
 *  per person, grouped by the department they work most that week, a cell per
 *  day saying when and what they mainly do, their paid hours at the end. What
 *  still needs someone (unfilled duties, booking places, cover for someone
 *  off) sits in a "To fill" row above everyone. Pure and tested; the page
 *  loads the week and the roster component draws it. */

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
};
export type RosterPerson = { key: string; userId: string | null; name: string; days: RosterCell[][]; minutes: number };
export type RosterGroup = { key: string; label: string; people: RosterPerson[] };
/** Something that needs a person: an unfilled duty, a booking place, or cover for someone off. */
export type RosterFill = { id: string; what: string; time: string; start: number; end: number; cover: string | null };

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

export function buildRoster(days: readonly { iso: string; shifts: readonly RosterShift[] }[]) {
  type Person = { key: string; userId: string | null; name: string; entries: { day: number; s: RosterShift }[] };
  const people = new Map<string, Person>();
  const fill: RosterFill[][] = days.map(() => []);
  days.forEach((d, day) => {
    for (const s of d.shifts) {
      if (s.kind !== "shift") continue;
      const key = s.userId ? `u:${s.userId}` : s.rotaPersonId ? `p:${s.rotaPersonId}` : null;
      const what = s.bookingNeed?.role ? `${s.bookingNeed.role}: ${s.role.replace(/^[^:]+:\s*/, "")}` : s.role;
      if (!key) { fill[day].push({ id: s.id, what, time: span(s), start: s.startMinutes, end: s.endMinutes, cover: null }); continue; }
      const name = s.user?.name ?? s.rotaPerson?.name ?? "Someone";
      if (s.warnings.includes("absent")) fill[day].push({ id: s.id, what, time: span(s), start: s.startMinutes, end: s.endMinutes, cover: name });
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
        warnings: s.warnings.filter((w) => w !== "absent" && w !== "open"), editable: !s.importId });
    }
    g.people.push({ key: p.key, userId: p.userId, name: p.name, days: cells,
      minutes: p.entries.filter(({ s }) => !s.warnings.includes("absent")).reduce((m, { s }) => m + paid(s), 0) });
    groups.set(label, g);
  }
  const sorted = [...groups.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map(({ key, label, people: list }) => ({ key, label, people: list.sort((a, b) => a.name.localeCompare(b.name)) }));

  const all = sorted.flatMap((g) => g.people);
  const offShifts = all.flatMap((p) => p.days.flat()).filter((c) => c.absent);
  return {
    groups: sorted,
    fill,
    tiles: {
      people: all.length,
      minutes: all.reduce((m, p) => m + p.minutes, 0),
      toFill: fill.reduce((n, list) => n + list.length, 0),
      offPeople: all.filter((p) => p.days.flat().some((c) => c.absent)).length,
      offShifts: offShifts.length,
      warnings: all.flatMap((p) => p.days.flat()).filter((c) => !c.absent && c.warnings.length).length,
    },
  };
}
export type RosterData = ReturnType<typeof buildRoster>;
