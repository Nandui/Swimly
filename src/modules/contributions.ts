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

// ---------------------------------------------------------------------------
// Home page cards
// ---------------------------------------------------------------------------

/** Who is looking at the home page: the session user, as far as a card needs. */
export type HomeViewer = {
  id: string;
  name: string;
  permissions: readonly string[];
  /** Everything they hold anywhere: at other sites or over their team too. */
  anywhere: readonly string[];
  isSuperadmin: boolean;
};

/** A quick action's icon, by name, so modules stay free of UI imports. */
export type HomeIcon = "search" | "userPlus" | "calendarPlus" | "receipt" | "userX" | "filePlus" | "clipboardCheck";

/** One thing a module puts on the home page. Where it shows depends on its kind:
 *  - `"action"`: a quick action button at the top ("Add a swimmer");
 *  - `"today"`: a fact about today, with its figure ("Classes today: 14");
 *  - anything with a `count`: a tile under "Waiting for you";
 *  - otherwise a link on the module's own card. */
export type HomeItem = {
  label: string;
  href: string;
  hint?: string;
  count?: number;
  /** Something is waiting that this person should act on. */
  attention?: boolean;
  kind?: "action" | "today";
  icon?: HomeIcon;
  /** A few short lines under a today fact, e.g. an instructor's next classes. */
  list?: { label: string; hint?: string }[];
};

export type HomeCard = {
  /** The module's id in `src/modules/registry.ts`. */
  moduleId: string;
  /** Only what this viewer may already open; counts stay within their access. */
  items(viewer: HomeViewer): Promise<HomeItem[]>;
};

const homeCards: HomeCard[] = [];

/** One card per module; registering again replaces it (a reloaded module in
 *  development brings its new card). */
export function registerHomeCard(card: HomeCard) {
  const at = homeCards.findIndex((c) => c.moduleId === card.moduleId);
  if (at >= 0) homeCards[at] = card;
  else homeCards.push(card);
}

/** The items for each of these modules. A module whose card fails shows its
 *  plain link instead, so one module can never break the home page. */
export async function homeCardItems(moduleIds: readonly string[], viewer: HomeViewer): Promise<Map<string, HomeItem[]>> {
  const out = new Map<string, HomeItem[]>();
  await Promise.all(moduleIds.map(async (id) => {
    const card = homeCards.find((c) => c.moduleId === id);
    if (!card) return;
    try {
      out.set(id, await card.items(viewer));
    } catch (error) {
      console.error(`Home card for ${id} failed`, error);
    }
  }));
  return out;
}
