/** Dates in Work's form (src/lib/format.ts): en-GB, no comma, three-letter months. The string
 *  is assembled from the parts, as Work does, because ICU versions differ on the comma after the
 *  weekday, and en-GB abbreviates September as "Sept" (cut to "Sep" here). */
const PARTS = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function partsOf(value: Date) {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of PARTS.formatToParts(value)) parts[part.type] = part.type === "month" && part.value === "Sept" ? "Sep" : part.value;
  return parts;
}

/** `YYYY-MM-DD` → "Mon 5 Oct". */
export function day(iso: string | null | undefined) {
  if (!iso) return "";
  const p = partsOf(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** A date or timestamp → "5 Oct 2026". */
export function date(value: string | null | undefined) {
  if (!value) return "";
  const p = partsOf(new Date(value.length === 10 ? `${value}T00:00:00Z` : value));
  return `${p.day} ${p.month} ${p.year}`;
}

export function clock(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
