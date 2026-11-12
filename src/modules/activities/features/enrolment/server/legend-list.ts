/** Matching a list exported from Legend against the swim school's Legend
 *  checks: every outstanding place whose swimmer's member number is on the
 *  list is confirmed as updated in Legend (owner decision, 29 September 2026).
 *  Pure, so the rule is tested on its own; the server reads the file and the
 *  places. */

export class LegendListError extends Error {}

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value)).replace(/\s+/g, " ").trim();
const normaliseMember = (value: string) => value.replace(/\s+/g, "").toUpperCase();

/** The member numbers in the export's data sheet (header first), each once. */
export function parseLegendList(rows: readonly (readonly unknown[])[]): string[] {
  const header = (rows[0] ?? []).map(text);
  const member = header.findIndex((h) => h.toLowerCase() === "member number");
  if (member < 0) throw new LegendListError("This does not look like a Legend member list: there is no Member Number column.");
  const numbers = new Set<string>();
  for (const row of rows.slice(1)) {
    const value = normaliseMember(text(row[member]));
    if (/^[A-Z]{2,4}\d{3,}$/.test(value)) numbers.add(value); // skips blanks and "998 rows found."
  }
  return [...numbers];
}

export type Place = { id: string; memberNumber: string | null; siteId: string };

/** The outstanding places the list confirms, at the sites this person may confirm at. */
export function placesToConfirm<P extends Place>(numbers: readonly string[], outstanding: readonly P[], sites: ReadonlySet<string> | "all"): P[] {
  const listed = new Set(numbers);
  return outstanding.filter((p) => !!p.memberNumber && listed.has(normaliseMember(p.memberNumber)) && (sites === "all" || sites.has(p.siteId)));
}
