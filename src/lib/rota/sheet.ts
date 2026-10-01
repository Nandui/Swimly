import { clock, type RotaWarning } from "@/lib/rota/constants";

/** The week as a roster sheet (owner request, 1 October 2026: "supposed to
 *  look like a roster sheet"): one row per person, a column per day, grouped
 *  by the department they work most that week, with their hours. Unfilled
 *  shifts get their own row at the top. Pure and tested; the page loads the
 *  shifts and the sheet component draws it. */

export type SheetShift = {
  id: string;
  kind: string;
  startMinutes: number;
  endMinutes: number;
  role: string;
  note: string;
  departmentCode: string | null;
  importId: string | null;
  userId: string | null;
  rotaPersonId: string | null;
  user: { name: string } | null;
  rotaPerson: { name: string; employeeNo?: string } | null;
  requiredType: { name: string } | null;
  warnings: RotaWarning[];
};

export type SheetEntry = {
  id: string;
  kind: "shift" | "holiday" | "leave";
  /** "06:30–14:00", or the leave's name. */
  text: string;
  minutes: number;
  /** Set when this entry is in another department than the row's group. */
  department: string | null;
  absent: boolean;
  /** Qualification and double-booking warnings, never "absent" or "open". */
  warnings: RotaWarning[];
  /** Added by hand, so it can be changed here; imported ones change by uploading again. */
  editable: boolean;
  detail: string;
};

export type SheetRow = { key: string; name: string; sub: string; days: SheetEntry[][]; minutes: number; shifts: number };
export type SheetGroup = { key: string; label: string; rows: SheetRow[] };

const span = (s: Pick<SheetShift, "startMinutes" | "endMinutes">) =>
  `${clock(s.startMinutes)}–${s.endMinutes > 1440 ? clock(s.endMinutes - 1440) : clock(s.endMinutes)}`;

/** Hours as a sheet shows them: "37.5", "8", "0". */
export function hours(minutes: number) {
  const h = Math.round((minutes / 60) * 4) / 4;
  return Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/0$/, "");
}

export function buildSheet(days: readonly { iso: string; shifts: readonly SheetShift[] }[], leaveLabel: (s: SheetShift) => string) {
  type Person = { key: string; name: string; sub: string; entries: { day: number; s: SheetShift }[] };
  const people = new Map<string, Person>();
  const open: { day: number; s: SheetShift }[] = [];
  days.forEach((d, day) => {
    for (const s of d.shifts) {
      const key = s.rotaPersonId ? `p:${s.rotaPersonId}` : s.userId ? `u:${s.userId}` : null;
      if (!key) { open.push({ day, s }); continue; }
      const person = people.get(key) ?? { key, name: s.rotaPerson?.name ?? s.user?.name ?? "Someone", sub: s.rotaPerson?.employeeNo ? `No. ${s.rotaPerson.employeeNo}` : "", entries: [] };
      person.entries.push({ day, s });
      people.set(key, person);
    }
  });

  const entry = (s: SheetShift, group: string): SheetEntry => {
    const shift = s.kind === "shift";
    const minutes = shift ? Math.max(0, s.endMinutes - s.startMinutes) : 0;
    return {
      id: s.id, kind: shift ? "shift" : s.kind === "holiday" ? "holiday" : "leave",
      text: shift ? span(s) : leaveLabel(s), minutes,
      department: shift && s.role !== group ? s.role : null,
      absent: s.warnings.includes("absent"),
      warnings: s.warnings.filter((w) => w !== "absent" && w !== "open"),
      editable: !s.importId,
      detail: [s.role, s.requiredType ? `Needs ${s.requiredType.name}` : null, s.note && shift ? s.note : null].filter(Boolean).join(" · "),
    };
  };
  const row = (key: string, name: string, sub: string, list: { day: number; s: SheetShift }[], group: string): SheetRow => {
    const cells: SheetEntry[][] = days.map(() => []);
    for (const { day, s } of [...list].sort((a, b) => a.s.startMinutes - b.s.startMinutes)) cells[day].push(entry(s, group));
    const shifts = list.filter((e) => e.s.kind === "shift");
    return { key, name, sub, days: cells, minutes: shifts.reduce((m, e) => m + Math.max(0, e.s.endMinutes - e.s.startMinutes), 0), shifts: shifts.length };
  };

  // Each person sits in the department they work most this week; holiday-only weeks use their leave's department.
  const groups = new Map<string, { key: string; label: string; order: string; rows: SheetRow[] }>();
  for (const p of people.values()) {
    const time = new Map<string, { minutes: number; code: string }>();
    for (const { s } of p.entries) {
      const t = time.get(s.role) ?? { minutes: 0, code: s.departmentCode ?? "" };
      t.minutes += s.kind === "shift" ? Math.max(1, s.endMinutes - s.startMinutes) : 0;
      time.set(s.role, t);
    }
    const [label, { code }] = [...time].sort((a, b) => b[1].minutes - a[1].minutes || a[0].localeCompare(b[0]))[0];
    const g = groups.get(label) ?? { key: `g:${label}`, label, order: code || `~${label}`, rows: [] };
    g.rows.push(row(p.key, p.name, p.sub, p.entries, label));
    groups.set(label, g);
  }
  const sorted = [...groups.values()]
    .sort((a, b) => a.order.localeCompare(b.order) || a.label.localeCompare(b.label))
    .map(({ key, label, rows }) => ({ key, label, rows: rows.sort((a, b) => a.name.localeCompare(b.name)) }));

  const openRow = open.length ? row("open", "Unfilled", "Needs someone", open, "") : null;
  if (openRow) for (const cell of openRow.days) for (const e of cell) e.department = open.find((o) => o.s.id === e.id)!.s.role;
  // How many people are on shift each day (not holiday, not off).
  const onShift = days.map((_, day) => new Set([...people.values()].filter((p) => p.entries.some((e) => e.day === day && e.s.kind === "shift" && !e.s.warnings.includes("absent"))).map((p) => p.key)).size);
  const dayMinutes = days.map((_, day) => [...people.values()].flatMap((p) => p.entries).filter((e) => e.day === day && e.s.kind === "shift").reduce((m, e) => m + Math.max(0, e.s.endMinutes - e.s.startMinutes), 0));
  return { groups: sorted, open: openRow, onShift, dayMinutes, people: people.size };
}
export type RotaSheetData = ReturnType<typeof buildSheet>;
