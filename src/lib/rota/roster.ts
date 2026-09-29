import { addDaysIso, clock } from "@/lib/rota/constants";

/** Reading the payroll system's weekly roster export ("RosterBrowser", one
 *  sheet named "Roster for 2026-W40"): a header of EmpNo, EmployeeName, then
 *  a pair of columns per day (Mon-28/09, Dept, …) and Total. One row per
 *  person per shift; someone with two shifts on a day has a second row. A
 *  day cell is a time range ("06:30 - 14:00") or a code: FHOP is a full
 *  holiday, paid; any other code is kept as leave with its code. Pure, so
 *  the rules are tested on their own; the server reads the file. */

export type RosterKind = "shift" | "holiday" | "leave";

export type RosterEntry = {
  employeeNo: string;
  name: string;
  date: string;
  kind: RosterKind;
  /** Minutes past midnight; an overnight shift ends after 24:00. Zero for holiday and leave. */
  start: number;
  end: number;
  /** The department code, e.g. "520". */
  department: string;
  /** Holiday and leave: the roster's code, e.g. "FHOP". */
  code: string;
};

export type ParsedRoster = {
  weekStart: string;
  entries: RosterEntry[];
  people: { employeeNo: string; name: string }[];
  /** Cells or rows that could not be read, in words for the importer. */
  problems: string[];
};

/** Roster codes that are not times. Anything else is "leave" with its code. */
export const ROSTER_CODE_META = {
  FHOP: { label: "Full holiday (paid)", kind: "holiday" },
} as const satisfies Record<string, { label: string; kind: RosterKind }>;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const text = (value: unknown) => (value === null || value === undefined ? "" : String(value)).replace(/\s+/g, " ").trim();

/** The Monday of ISO week `week` of `year` (week 1 holds 4 January). */
export function isoWeekMonday(year: number, week: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday1 = addDaysIso(jan4.toISOString().slice(0, 10), -((jan4.getUTCDay() + 6) % 7));
  return addDaysIso(monday1, (week - 1) * 7);
}

export function parseRoster(sheetName: string, rows: readonly (readonly unknown[])[]): ParsedRoster {
  const problems: string[] = [];
  const week = /(\d{4})-W(\d{1,2})/.exec(sheetName);
  if (!week) throw new RosterError(`This does not look like a roster export: the sheet is called "${sheetName}", not "Roster for <year>-W<week>".`);
  const weekStart = isoWeekMonday(Number(week[1]), Number(week[2]));

  const header = (rows[0] ?? []).map(text);
  if (header[0] !== "EmpNo" || header[1] !== "EmployeeName") throw new RosterError("The first row should start with EmpNo and EmployeeName.");
  const dayColumns: { col: number; date: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const col = 2 + i * 2;
    const match = /^([A-Za-z]{3})-(\d{2})\/(\d{2})$/.exec(header[col] ?? "");
    const date = addDaysIso(weekStart, i);
    if (!match || match[1] !== DAYS[i] || `${match[2]}/${match[3]}` !== `${date.slice(8, 10)}/${date.slice(5, 7)}`) {
      throw new RosterError(`Column ${col + 1} should be ${DAYS[i]}-${date.slice(8, 10)}/${date.slice(5, 7)} for ${sheetName}, but it is "${header[col] ?? ""}".`);
    }
    dayColumns.push({ col, date });
  }

  const entries: RosterEntry[] = [];
  const people = new Map<string, string>();
  rows.slice(1).forEach((row, index) => {
    const employeeNo = text(row[0]);
    const name = text(row[1]);
    // The closing "Overall Total" row has no employee number.
    if (!employeeNo || !name || /^overall total$/i.test(name)) return;
    for (const { col, date } of dayColumns) {
      const value = text(row[col]).toUpperCase();
      if (!value) continue;
      const department = text(row[col + 1]);
      const where = `${name} on ${date}`;
      if (!department) problems.push(`${where}: "${value}" has no department, so it was left out.`);
      const times = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(value);
      if (times) {
        const start = Number(times[1]) * 60 + Number(times[2]);
        let end = Number(times[3]) * 60 + Number(times[4]);
        if (start >= 24 * 60 || end > 24 * 60 || Number(times[2]) > 59 || Number(times[4]) > 59) { problems.push(`${where}: "${value}" is not a time range, so it was left out.`); continue; }
        if (end <= start) end += 24 * 60; // overnight, ends the next morning
        if (end - start > 16 * 60) { problems.push(`${where}: "${value}" is longer than 16 hours, so it was left out.`); continue; }
        if (department) entries.push({ employeeNo, name, date, kind: "shift", start, end, department, code: "" });
      } else if (/^[A-Z]{2,8}$/.test(value)) {
        const known = ROSTER_CODE_META[value as keyof typeof ROSTER_CODE_META];
        if (department) entries.push({ employeeNo, name, date, kind: known?.kind ?? "leave", start: 0, end: 0, department, code: value });
      } else {
        problems.push(`${where} (row ${index + 2}): "${value}" is neither a time range nor a code, so it was left out.`);
        continue;
      }
      if (department) people.set(employeeNo, name);
    }
  });
  return { weekStart, entries, people: [...people].map(([employeeNo, name]) => ({ employeeNo, name })), problems };
}

export class RosterError extends Error {}

/** One day's entries for one person, as plain text for the change log. */
export function describeDay(entries: readonly Pick<RosterEntry, "kind" | "start" | "end" | "department" | "code">[]) {
  return [...entries]
    .sort((a, b) => a.start - b.start || a.department.localeCompare(b.department))
    .map((e) => e.kind === "shift"
      ? `${clock(e.start)}–${e.end > 24 * 60 ? `${clock(e.end - 24 * 60)} (next day)` : clock(e.end)} · ${e.department}`
      : `${ROSTER_CODE_META[e.code as keyof typeof ROSTER_CODE_META]?.label ?? e.code} · ${e.department}`)
    .join(", ");
}

export type RosterChange = { employeeNo: string; name: string; date: string; kind: "added" | "removed" | "changed"; before: string; after: string };

/** What a new upload changes, person by person and day by day. */
export function diffRoster(before: readonly RosterEntry[], after: readonly RosterEntry[]): RosterChange[] {
  const byDay = (list: readonly RosterEntry[]) => {
    const map = new Map<string, RosterEntry[]>();
    for (const e of list) map.set(`${e.employeeNo}|${e.date}`, [...(map.get(`${e.employeeNo}|${e.date}`) ?? []), e]);
    return map;
  };
  const was = byDay(before), now = byDay(after);
  const changes: RosterChange[] = [];
  for (const key of new Set([...was.keys(), ...now.keys()])) {
    const a = was.get(key) ?? [], b = now.get(key) ?? [];
    const from = describeDay(a), to = describeDay(b);
    if (from === to) continue;
    const [employeeNo, date] = key.split("|");
    changes.push({ employeeNo, date, name: (b[0] ?? a[0]).name, kind: !a.length ? "added" : !b.length ? "removed" : "changed", before: from, after: to });
  }
  return changes.sort((x, y) => x.date.localeCompare(y.date) || x.name.localeCompare(y.name));
}

/** "O Halloran Eoin" and "Eoin O'Halloran" name the same person: the roster
 *  puts the surname first and writes O', Mc and Mac as separate words. Compare
 *  the name parts in any order, with those prefixes joined to the next part. */
export function sameName(a: string, b: string) {
  const parts = (s: string) => {
    const words = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z\s-]/g, " ").split(/[\s-]+/).filter(Boolean);
    const joined: string[] = [];
    for (let i = 0; i < words.length; i++) {
      if (/^(o|mc|mac)$/.test(words[i]) && words[i + 1]) { joined.push(words[i] + words[i + 1]); i++; } else joined.push(words[i]);
    }
    return joined.sort().join(" ");
  };
  const x = parts(a), y = parts(b);
  return x.length > 0 && x === y;
}
