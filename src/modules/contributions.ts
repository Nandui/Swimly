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
export type HomeIcon = "userPlus" | "calendarPlus" | "receipt" | "userX" | "filePlus" | "clipboardCheck";

type HomeItemBase = {
  label: string;
  href: string;
  /** One line more. On a figure that needs the person, it is the reason in the tag. */
  hint?: string;
  /** Something is waiting that this person should act on. */
  attention?: boolean;
  /** The quick action's or figure's icon; a figure without one shows its module's. */
  icon?: HomeIcon;
};

/** One thing a module puts on the home page and its own overview. Where it shows depends on
 *  its kind:
 *  - `"action"`: a quick action ("Add a swimmer");
 *  - `"today"`: a figure about today at the working site ("Classes: 14");
 *  - `"timeline"`: today's sessions on the day-at-a-glance timeline, one lane per area;
 *  - no kind: a queue under "Waiting for you", which must carry its `count`.
 *  There are no plain links: the module's pages are in its page bar and overview. */
export type HomeItem =
  | (HomeItemBase & { kind: "action"; count?: undefined; sessions?: undefined })
  | (HomeItemBase & { kind: "today"; count: number; sessions?: undefined })
  | (HomeItemBase & { kind: "timeline"; sessions: HomeSession[]; count?: undefined })
  | (HomeItemBase & { kind?: undefined; count: number; sessions?: undefined });

/** One block on the home timeline. Its state picks the colour and the label, from
 *  `HOME_SESSION_META`; times are minutes after midnight. */
export type HomeSession = {
  label: string;
  /** The lane it sits in, e.g. a pool area. */
  area: string;
  start: number;
  end: number;
  /** Who is running it, or a short note such as "6 booked". */
  hint?: string;
  state: "done" | "now" | "next" | "cover" | "off" | "assessment";
  href: string;
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

/** Each module's items, and the modules whose card failed to load. */
export type HomeCardItems = Map<string, HomeItem[]> & { failed: string[] };

/** The items for each of these modules. A module whose card fails is left out
 *  and named in `failed`, so the page can say its figures didn't load; one
 *  module can never break the home page. */
export async function homeCardItems(moduleIds: readonly string[], viewer: HomeViewer): Promise<HomeCardItems> {
  const out = new Map<string, HomeItem[]>();
  const failed: string[] = [];
  await Promise.all(moduleIds.map(async (id) => {
    const card = homeCards.find((c) => c.moduleId === id);
    if (!card) return;
    try {
      out.set(id, await card.items(viewer));
    } catch (error) {
      console.error(`Home card for ${id} failed`, error);
      failed.push(id);
    }
  }));
  return Object.assign(out, { failed: moduleIds.filter((id) => failed.includes(id)) });
}

// ---------------------------------------------------------------------------
// Personal file
// ---------------------------------------------------------------------------

/** One thing on a person's file, in words: "Sickness, 29 Sep to 2 Oct (4 days)"
 *  with its detail, "Return to work 3 Oct with Maya: fit to work". */
export type PersonFileEntry = { id: string; title: string; detail: string; /** ISO date it is about. */ on: string };

/** What a module keeps about one person for their personal file (the HR
 *  record and its export), such as Rota's absences and returns to work.
 *  Callers must already hold `hr.records.read` over the person and log the
 *  read; sections return what the module holds, never permissions. */
export type PersonFileSection = {
  /** Stable key, e.g. "rota.absences". */
  id: string;
  heading: string;
  load(userId: string, orgId: string): Promise<{ summary: string; entries: PersonFileEntry[] }>;
};

const personFileSections: PersonFileSection[] = [];

export function registerPersonFileSection(section: PersonFileSection) {
  const at = personFileSections.findIndex((s) => s.id === section.id);
  if (at >= 0) personFileSections[at] = section;
  else personFileSections.push(section);
}

/** Every registered section of this person's file, in registration order. */
export async function personFile(userId: string, orgId: string) {
  return Promise.all(personFileSections.map(async (section) => ({ id: section.id, heading: section.heading, ...(await section.load(userId, orgId)) })));
}

// ---------------------------------------------------------------------------
// Commitments: who is busy when
// ---------------------------------------------------------------------------

/** Someone (or nobody yet) committed to something at a site for a time on a
 *  day: a swim class they teach, a duty on the rota. Modules report their own,
 *  and any module can check a person's time against everyone else's, so a
 *  supervisor sees "teaching a class then" without Rota importing the swim
 *  school. When a module moves to its own app, its source calls that app. */
export type Commitment = {
  /** The source's id, e.g. "activities.classes". */
  source: string;
  userId: string | null;
  siteId: string;
  /** ISO date. */
  date: string;
  startMinutes: number;
  endMinutes: number;
  /** "Level 3, Learner pool". */
  label: string;
  /** Where in the site, when the source knows: "Learner pool". */
  place?: string;
  /** The label without the place: "Level 3". */
  title?: string;
  /** Where to see or change it. */
  href?: string;
  /** The source's own id for the thing (a class), for `planCommitment`. */
  ref?: string;
  /** Planned for this date from another module (the rota), not the thing's usual person. */
  planned?: boolean;
};
export type CommitmentQuery = { siteIds?: readonly string[]; userIds?: readonly string[]; from: string; to: string };
/** Who to plan on one occurrence: `userId` null plans nobody (a gap). The source checks the
 *  thing still happens that day and records it with its own audit; the caller has already
 *  checked its own permission to plan at that site. */
export type CommitmentPlan = { ref: string; siteId: string; date: string; userId: string | null; by: { id: string; name: string } };
export type CommitmentSource = {
  id: string;
  list(query: CommitmentQuery): Promise<Commitment[]>;
  /** Lets another module plan who does one occurrence (the rota planning a class's teacher). */
  plan?(input: CommitmentPlan): Promise<{ ok: true } | { ok: false; error: string }>;
};

const commitmentSources: CommitmentSource[] = [];

export function registerCommitments(source: CommitmentSource) {
  const at = commitmentSources.findIndex((s) => s.id === source.id);
  if (at >= 0) commitmentSources[at] = source;
  else commitmentSources.push(source);
}

/** Every registered source's commitments matching the query, except the
 *  caller's own (it knows those already). Callers must hold the access the
 *  page needs; these are times and short labels, never records. */
export async function commitmentsFor(query: CommitmentQuery, except?: string) {
  if (query.userIds && query.userIds.length === 0 && !query.siteIds) return [];
  const lists = await Promise.all(commitmentSources.filter((s) => s.id !== except).map((s) => s.list(query)));
  return lists.flat();
}

/** Plan who does one occurrence of another module's commitment (owner decision, 6 October 2026:
 *  Rota assigns swim teachers; the swim school keeps the record). */
export async function planCommitment(sourceId: string, input: CommitmentPlan) {
  const source = commitmentSources.find((s) => s.id === sourceId);
  if (!source?.plan) return { ok: false as const, error: "That can no longer be planned from here." };
  return source.plan(input);
}

/** A site's area renamed in Admin (docs/admin-setup.md): each module that stores
 *  area names (the rota's activities and bookings, the swim school's classes and
 *  assessments) updates its own records, so they keep reading the same way. Core
 *  calls these; it never touches a module's tables itself. Runs inside Core's
 *  transaction when it passes one, so a failed rename leaves nothing half done. */
export type AreaRename = { siteId: string; from: string; to: string };
export type AreaRenameHandler = { id: string; rename(change: AreaRename, tx?: unknown): Promise<number> };
const areaRenameHandlers: AreaRenameHandler[] = [];

export function registerAreaRename(handler: AreaRenameHandler) {
  const at = areaRenameHandlers.findIndex((h) => h.id === handler.id);
  if (at >= 0) areaRenameHandlers[at] = handler;
  else areaRenameHandlers.push(handler);
}

/** Every module's records renamed; how many changed in all. */
export async function renameAreaEverywhere(change: AreaRename, tx?: unknown) {
  let changed = 0;
  for (const handler of areaRenameHandlers) changed += await handler.rename(change, tx);
  return changed;
}
