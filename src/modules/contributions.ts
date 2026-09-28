import "server-only";

/** What a module adds to Core's own screens, without Core importing the module.
 *
 *  Core owns people and sites; modules such as Aquatics know what those people
 *  teach and what each site runs. A module registers small read-only
 *  summaries here, and the Core pages (Staff, Clubs) show whatever is
 *  registered. When a module moves to its own app, its contribution becomes a
 *  call to that app's API and Core does not change.
 *
 *  Register from the module's own `contributions.ts`, wired up in
 *  `src/modules/server.ts`. Callers must already hold the page's permission:
 *  these return counts and short labels, never records. */

export type StaffColumn = {
  /** Stable key for React and ordering, e.g. "activities.classes". */
  id: string;
  /** Column header on the Staff page, e.g. "Classes". */
  header: string;
  /** A short value per person; people without one are left blank. */
  values(userIds: string[]): Promise<Map<string, string>>;
};

export type SiteSummary = {
  id: string;
  /** One short line per site, e.g. "3 programmes · 1,156 active swimmers". */
  lines(clubIds: string[]): Promise<Map<string, string>>;
};

const staffColumns: StaffColumn[] = [];
const siteSummaries: SiteSummary[] = [];

export function registerStaffColumn(column: StaffColumn) {
  if (!staffColumns.some((c) => c.id === column.id)) staffColumns.push(column);
}

export function registerSiteSummary(summary: SiteSummary) {
  if (!siteSummaries.some((s) => s.id === summary.id)) siteSummaries.push(summary);
}

/** Every registered column with its values for these people. */
export async function staffColumnValues(userIds: string[]) {
  return Promise.all(staffColumns.map(async (column) => ({ id: column.id, header: column.header, values: await column.values(userIds) })));
}

/** One combined line per site from every registered module. */
export async function siteSummaryLines(clubIds: string[]): Promise<Map<string, string>> {
  const parts = await Promise.all(siteSummaries.map((summary) => summary.lines(clubIds)));
  const out = new Map<string, string>();
  for (const id of clubIds) {
    const line = parts.map((part) => part.get(id)).filter(Boolean).join(" · ");
    if (line) out.set(id, line);
  }
  return out;
}
