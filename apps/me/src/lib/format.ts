const DATE = new Intl.DateTimeFormat("en-IE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const FULL = new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** `YYYY-MM-DD` → "Mon 5 Oct". */
export function day(iso: string | null | undefined) {
  return iso ? DATE.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "";
}

/** A date or timestamp → "5 Oct 2026". */
export function date(value: string | null | undefined) {
  return value ? FULL.format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value)) : "";
}

export function clock(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
