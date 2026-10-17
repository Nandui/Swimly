/** An area's staff needs and the hours it is open (Admin, Areas; owner requests, 16 October
 *  2026), shared by the page, its dialog and the rota. Pure. */

type Minimum = { count: number; typeId: string | null; typeName: string | null };
/** A weekday's own hours, Monday 0: no times is closed that day. */
export type WeekHour = { day: number; from: number | null; until: number | null };
export type AreaHours = { openFrom: number | null; openUntil: number | null; weekHours: readonly WeekHour[] };

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** 420 as "07:00"; null as empty. */
export const hhmm = (minutes: number | null) => (minutes === null ? "" : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);

const minute = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 24 * 60 ? v : null);

/** The stored `weekHours` as a list, ignoring anything that is not a weekday's hours. */
export function weekHoursOf(json: unknown): WeekHour[] {
  if (!Array.isArray(json)) return [];
  const out = new Map<number, WeekHour>();
  for (const x of json) {
    if (!x || typeof x !== "object") continue;
    const { day, from, until } = x as Record<string, unknown>;
    if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6) continue;
    const f = minute(from), u = minute(until);
    out.set(day, f !== null && u !== null && u > f ? { day, from: f, until: u } : { day, from: null, until: null });
  }
  return [...out.values()].sort((a, b) => a.day - b.day);
}

/** Staff in another area covering this one while both are open (owner request, 16 October 2026:
 *  one lifeguard by the door between the main hall and the 18 m pool): `count` of this type of
 *  staff (`typeId`, null for anyone) in the other area for both. */
export type AreaTogether = { withAreaId: string; count: number; typeId: string | null };

/** The stored `together` as a list, ignoring anything that is not one. */
export function togetherOf(json: unknown): AreaTogether[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const { withAreaId, count, typeId } = x as Record<string, unknown>;
    if (typeof withAreaId !== "string" || !withAreaId || typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 30) return [];
    return [{ withAreaId, count, typeId: typeof typeId === "string" && typeId ? typeId : null }];
  });
}

/** Monday 0 for a date like "2026-10-16". */
export const weekdayOf = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

/** When the area is open on a date: the weekday's own hours, else every day's; null when closed
 *  or no hours are set. */
export function hoursOn(area: AreaHours, date: string): { start: number; end: number } | null {
  const own = area.weekHours.find((w) => w.day === weekdayOf(date));
  const from = own ? own.from : area.openFrom, until = own ? own.until : area.openUntil;
  return from !== null && until !== null && until > from ? { start: from, end: until } : null;
}

/** "2 NPLQ and 1 anyone · open 07:00 to 22:00, Saturday 09:00 to 18:00, Sunday closed", or null
 *  with no staff set. */
export function staffingWords(area: { minimums: Minimum[] } & AreaHours) {
  if (!area.minimums.length) return null;
  const lines = area.minimums.map((m) => `${m.count} ${m.typeId ? m.typeName ?? "qualified" : "anyone"}`);
  const list = lines.length > 1 ? `${lines.slice(0, -1).join(", ")} and ${lines[lines.length - 1]}` : lines[0];
  return `Needs ${list} · ${hoursWords(area)}`;
}

/** "open 07:00 to 22:00, Saturday 09:00 to 18:00, Sunday closed". */
export function hoursWords(area: AreaHours) {
  const every = area.openFrom !== null && area.openUntil !== null ? `open ${hhmm(area.openFrom)} to ${hhmm(area.openUntil)}` : null;
  const own = area.weekHours.map((w) => `${WEEKDAYS[w.day]} ${w.from !== null && w.until !== null ? `${hhmm(w.from)} to ${hhmm(w.until)}` : "closed"}`);
  return [every ?? (own.length ? "closed other days" : "no opening hours yet"), ...own].join(", ");
}
