import "server-only";
import { emit, type EventName, type PlatformEvents } from "@/platform/events";
import { appOn, sitesWhereOn } from "@/lib/apps/switches";
import type { Prisma } from "@/generated/prisma/client";

/** What a module adds to Core's own screens, without Core importing the module.
 *
 *  Core owns people and sites; modules such as Aquatics know what each site
 *  runs. A module registers small read-only summaries here, and the Core pages
 *  (Clubs) show whatever is registered. What a module keeps about a person
 *  goes to their HR personal file, never Admin's Staff pages. When a module moves to its own app, its contribution becomes a
 *  call to that app's API and Core does not change.
 *
 *  Register from the module's own `contributions.ts`, wired up in
 *  `src/modules/server.ts`. Callers must already hold the page's permission:
 *  these return counts and short labels, never records.
 *
 *  Every registration names its `app` (the manifest id), and a reader skips a plug whose app is
 *  switched off where the question is about (src/lib/apps/switches.ts): that site, or anywhere
 *  for a question about a person or the organisation. A switched-off app's plug answers "not
 *  available" as if it had never registered, and the caller copes. Two plugs keep reaching
 *  every app because they keep stored records whole: renaming a site's area, and HR's subject
 *  access export (everything held about a person, whatever is switched on). */

/** Loads every module's registrations (the composition root) before a module reads another's,
 *  as the platform registry loads the app's module list (AGENTS.md, The app contract). Modules call
 *  `personFile`, `subjectRecords`, `commitmentsFor` and `planCommitment` from here, so none of
 *  them imports the composition root; Core and front pages already load it through it. */
let modulesLoading: Promise<unknown> | undefined;
function modulesLoaded() {
  return (modulesLoading ??= import("@/modules/server"));
}

/** The items of a list whose site has the app on; an item without a site needs it on anywhere. */
async function onlyWhereOn<T>(app: string, items: readonly T[], siteOf: (item: T) => string | null): Promise<T[]> {
  const on = await Promise.all(items.map((item) => appOn(app, { siteId: siteOf(item) })));
  return items.filter((_, at) => on[at]);
}

export type SiteSummary = {
  id: string;
  /** The app it belongs to (its manifest id). */
  app: string;
  /** One short line per site, e.g. "3 programmes · 1,156 active swimmers". */
  lines(clubIds: string[]): Promise<Map<string, string>>;
};

const siteSummaries: SiteSummary[] = [];

export function registerSiteSummary(summary: SiteSummary) {
  if (!siteSummaries.some((s) => s.id === summary.id)) siteSummaries.push(summary);
}

/** One combined line per site from every registered module. */
export async function siteSummaryLines(clubIds: string[]): Promise<Map<string, string>> {
  const parts = await Promise.all(siteSummaries.map(async (summary) => {
    const sites = await sitesWhereOn(summary.app, clubIds);
    return sites.length ? summary.lines(sites) : new Map<string, string>();
  }));
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
  /** The app it belongs to (its manifest id). */
  app: string;
  heading: string;
  load(userId: string, orgId: string): Promise<{ summary: string; entries: PersonFileEntry[] }>;
};

const personFileSections: PersonFileSection[] = [];

export function registerPersonFileSection(section: PersonFileSection) {
  const at = personFileSections.findIndex((s) => s.id === section.id);
  if (at >= 0) personFileSections[at] = section;
  else personFileSections.push(section);
}

/** Every registered section of this person's file, in registration order, from the apps that
 *  are on somewhere in their organisation. */
export async function personFile(userId: string, orgId: string) {
  await modulesLoaded();
  const on = await Promise.all(personFileSections.map((section) => appOn(section.app, { orgId })));
  return Promise.all(personFileSections.filter((_, at) => on[at]).map(async (section) => ({ id: section.id, heading: section.heading, ...(await section.load(userId, orgId)) })));
}

/** Everything a module holds about one person, for a subject access request
 *  (HR's export): the full records, not the summary on their file. Same
 *  callers and rules as the personal file; only HR's export reads it. */
export type SubjectRecords = {
  /** The export's key for this module's records, e.g. "training". */
  key: string;
  load(userId: string, orgId: string): Promise<unknown>;
};

const subjectRecordSources: SubjectRecords[] = [];

export function registerSubjectRecords(source: SubjectRecords) {
  const at = subjectRecordSources.findIndex((s) => s.key === source.key);
  if (at >= 0) subjectRecordSources[at] = source;
  else subjectRecordSources.push(source);
}

/** Every registered module's records about this person, by key: from every app, switched on
 *  or not, because a subject access request covers everything held about them. */
export async function subjectRecords(userId: string, orgId: string): Promise<Record<string, unknown>> {
  await modulesLoaded();
  const loaded = await Promise.all(subjectRecordSources.map(async (s) => [s.key, await s.load(userId, orgId)] as const));
  return Object.fromEntries(loaded);
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
  /** The module it is planned in, for "Planned in Academy" on the Rota. */
  module?: string;
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
  /** The app it belongs to (its manifest id). */
  app: string;
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
  await modulesLoaded();
  const lists = await Promise.all(commitmentSources.filter((s) => s.id !== except).map(async (s) =>
    (await appOn(s.app)) ? onlyWhereOn(s.app, await s.list(query), (c) => c.siteId) : []));
  return lists.flat();
}

/** Plan who does one occurrence of another module's commitment (owner decision, 6 October 2026:
 *  Rota assigns swim teachers; the swim school keeps the record). */
export async function planCommitment(sourceId: string, input: CommitmentPlan) {
  await modulesLoaded();
  const source = commitmentSources.find((s) => s.id === sourceId);
  if (!source?.plan || !(await appOn(source.app, { siteId: input.siteId }))) return { ok: false as const, error: "That can no longer be planned from here." };
  return source.plan(input);
}

/** A site's area renamed in Admin: each module that stores
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

/** Every module's records renamed; how many changed in all. Switched-off apps too, so their
 *  records still read the same way when they are switched back on. */
export async function renameAreaEverywhere(change: AreaRename, tx?: unknown) {
  let changed = 0;
  for (const handler of areaRenameHandlers) changed += await handler.rename(change, tx);
  return changed;
}

// ---------------------------------------------------------------------------

/** Desk work that has a clock on it (owner request, 16 October 2026: performance manage the reception
 *  area): each module reports the jobs the desk did, or still has to do, with how long each took. An
 *  Academy place held online waits for a call back; a refund request waits as a draft until it is sent.
 *  The swim school's analytics reads every source, so it can show a person's response times across the
 *  modules they work in without importing any. One item per job; `open` items are still waiting. */
export type DeskMeasure = {
  /** Stable id of the kind of job, e.g. "academy.call-back". */
  kind: string;
  /** "Academy call backs". */
  label: string;
  /** The module's log name ("Short courses"). */
  module: string;
  siteId: string | null;
  /** Who did it; null while it is still waiting. */
  userId: string | null;
  userName: string | null;
  /** ISO: when it was done, or when it started waiting if still open. */
  at: string;
  /** Minutes from the job arriving to its being done (to now while open). */
  minutes: number;
  /** Done within the module's own promise (the 72-hour call back); null when there is none. */
  onTime: boolean | null;
  open: boolean;
};
export type DeskMeasureQuery = { siteIds: readonly string[] | null; from: string; to: string; now: Date };
export type DeskMeasureSource = { id: string; /** The app it belongs to (its manifest id). */ app: string; list(query: DeskMeasureQuery): Promise<DeskMeasure[]> };
const deskMeasureSources: DeskMeasureSource[] = [];

export function registerDeskMeasures(source: DeskMeasureSource) {
  const at = deskMeasureSources.findIndex((s) => s.id === source.id);
  if (at >= 0) deskMeasureSources[at] = source;
  else deskMeasureSources.push(source);
}

/** Every other module's desk jobs done between two local dates (inclusive), plus those still open.
 *  The caller holds the page's permission; these are times, names and counts, never records. A source
 *  that fails is left out and named in `failed`, so one module cannot blank the page. */
export async function deskMeasuresFor(query: DeskMeasureQuery, except?: string) {
  await modulesLoaded();
  const failed: string[] = [];
  const lists = await Promise.all(deskMeasureSources.filter((s) => s.id !== except).map(async (s) => {
    if (!(await appOn(s.app))) return [] as DeskMeasure[];
    const items = await s.list(query).catch((error) => {
      console.error(`Desk measures from ${s.id} failed`, error);
      failed.push(s.id);
      return [] as DeskMeasure[];
    });
    return onlyWhereOn(s.app, items, (item) => item.siteId);
  }));
  return { items: lists.flat(), failed };
}

// ---------------------------------------------------------------------------
// Members: the swimmer records other modules enrol from
// ---------------------------------------------------------------------------

/** One person on the centre's swimmer records (owner request, 21 October 2026: short courses and
 *  the Academy enrol people from the swimmer database, so a booking carries their member number,
 *  contacts and medical notes). The swim school owns these records and registers the directory;
 *  other modules keep only the id. Medical notes come back only when the caller says its viewer
 *  may read them (`medical`), otherwise just whether any are on file. */
export type Member = {
  id: string;
  memberNumber: string | null;
  firstName: string;
  lastName: string;
  /** ISO date. */
  dateOfBirth: string | null;
  active: boolean;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRelationship: string | null;
  hasMedicalNotes: boolean;
  medicalNotes: string | null;
};
/** A search result: enough to tell two people with the same name apart. */
export type MemberHit = Pick<Member, "id" | "memberNumber" | "firstName" | "lastName" | "dateOfBirth" | "active" | "contactName">;
/** A person who is not on the records yet. Empty strings mean "not given". */
/** One search across the person's apps (D19; roadmap step 4): what each app can be searched
 *  for, such as the swim school's members. Pages and apps are matched in the frame itself, and
 *  people by the platform (src/lib/search). An app answers only with what this viewer may open,
 *  and shows the least that names each hit: a name and a short line, never contact or medical
 *  details. Opening a hit checks permission again. */
export type SearchHit = { label: string; hint: string; href: string };
export type SearchSource = {
  /** The app answering (its manifest id). */
  app: string;
  /** At most 8 hits, best first. */
  search(q: string, viewer: HomeViewer): Promise<SearchHit[]>;
};

const searchSources: SearchSource[] = [];

/** One source per app; registering again replaces it. */
export function registerSearch(source: SearchSource) {
  const at = searchSources.findIndex((s) => s.app === source.app);
  if (at >= 0) searchSources[at] = source;
  else searchSources.push(source);
}

/** The hits from every app this person holds that is switched on. An app whose search fails is
 *  left out, so one app never breaks the search. */
export async function searchApps(q: string, moduleIds: readonly string[], viewer: HomeViewer): Promise<SearchHit[]> {
  await modulesLoaded();
  const lists = await Promise.all(searchSources.filter((s) => moduleIds.includes(s.app)).map(async (source) => {
    try {
      return (await appOn(source.app)) ? (await source.search(q, viewer)).slice(0, 8) : [];
    } catch (error) {
      console.error(`Search for ${source.app} failed`, error);
      return [];
    }
  }));
  return lists.flat();
}

export type NewMember = {
  firstName: string; lastName: string; dateOfBirth: string; memberNumber: string;
  contactName: string; contactEmail: string; contactPhone: string;
  emergencyName: string; emergencyPhone: string; emergencyRelationship: string; medicalNotes: string;
};
export type MemberDirectory = {
  /** The app that keeps the records (its manifest id). */
  app: string;
  /** Every word must match a name, the member number, a contact's name, email or phone, or the
   *  date of birth (2015-03-04 or 4/3/2015). At most 20, best first. */
  search(q: string): Promise<MemberHit[]>;
  byIds(ids: readonly string[], options: { medical: boolean }): Promise<Map<string, Member>>;
  /** The people holding these member numbers, keyed by the number in capitals without spaces (as
   *  Legend's exports match them). Numbers nobody holds are left out. */
  byNumbers(numbers: readonly string[]): Promise<Map<string, MemberHit>>;
  /** Adds them at a site, audited as added from the calling module. Refuses a person already on
   *  the records with the same name and date of birth, or a member number in use. */
  create(input: NewMember, context: { siteId: string; by: { id: string; name: string }; via: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
};

let memberDirectory: MemberDirectory | null = null;

export function registerMemberDirectory(directory: MemberDirectory) {
  memberDirectory = directory;
}

/** The swimmer records, or null when the swim school is switched off (or not there): callers then
 *  keep their own name-only entry. The caller has already checked its own permission for the
 *  person it serves. */
export async function members(): Promise<MemberDirectory | null> {
  await modulesLoaded();
  return memberDirectory && (await appOn(memberDirectory.app)) ? memberDirectory : null;
}

/** What other modules hold about one member, for their swimmer profile: "Couch to 5k at
 *  Riverside", "6 Oct to 10 Nov · booked". Titles and dates only, never payment or notes. */
export type MemberHistoryEntry = { id: string; title: string; detail: string; /** ISO date it starts. */ on: string; module: string };
export type MemberHistorySource = { id: string; /** The app it belongs to (its manifest id). */ app: string; list(memberId: string): Promise<MemberHistoryEntry[]> };
const memberHistorySources: MemberHistorySource[] = [];

export function registerMemberHistory(source: MemberHistorySource) {
  const at = memberHistorySources.findIndex((s) => s.id === source.id);
  if (at >= 0) memberHistorySources[at] = source;
  else memberHistorySources.push(source);
}

/** Every module's entries for this member, newest first. A failing source is left out. */
export async function memberHistoryFor(memberId: string): Promise<MemberHistoryEntry[]> {
  await modulesLoaded();
  const lists = await Promise.all(memberHistorySources.map(async (s) => !(await appOn(s.app)) ? [] : s.list(memberId).catch((error) => {
    console.error(`Member history from ${s.id} failed`, error);
    return [] as MemberHistoryEntry[];
  })));
  return lists.flat().sort((a, b) => b.on.localeCompare(a.on));
}

/** One place booked under an email address, as the public see it in "My bookings" on the
 *  Academy booking site (owner decision, 8 October 2026). The Academy keeps the site's API and its
 *  own courses; another app adds the places it holds under that email through this plug (D24:
 *  short courses booked at the desk), so the Academy never reads its tables. Never staff names,
 *  other people or notes. */
export type EmailBooking = {
  id: string;
  /** Which kind: "academy" or "short-courses". */
  source: string;
  reference: string | null;
  courseId: string;
  name: string;
  /** The name it was booked under (one email can book for several people). */
  person: string;
  categoryLabel: string;
  site: string;
  firstDay: string | null;
  lastDay: string | null;
  sessions: number;
  next: { date: string; start: string; end: string; place: string } | null;
  /** Where it stands. */
  state: "to-pay" | "booked" | "waiting" | "done" | "withdrawn" | "cancelled";
  /** A result or finer detail, e.g. "Passed", "Deposit paid". */
  detail: string;
  priceCents: number;
  paidCents: number;
  owedCents: number;
  callBy: string | null;
};
export type EmailBookingSource = { id: string; /** The app it belongs to (its manifest id). */ app: string; list(email: string): Promise<EmailBooking[]> };
const emailBookingSources: EmailBookingSource[] = [];

export function registerEmailBookings(source: EmailBookingSource) {
  const at = emailBookingSources.findIndex((s) => s.id === source.id);
  if (at >= 0) emailBookingSources[at] = source;
  else emailBookingSources.push(source);
}

/** Every other app's places under this (checked) email, so a customer still sees a place the
 *  desk booked. An app switched off is left out; a failing source is left out and logged. */
export async function emailBookingsFor(email: string): Promise<EmailBooking[]> {
  await modulesLoaded();
  const lists = await Promise.all(emailBookingSources.map(async (s) => !(await appOn(s.app)) ? [] : s.list(email).catch((error) => {
    console.error(`Bookings by email from ${s.id} failed`, error);
    return [] as EmailBooking[];
  })));
  return lists.flat();
}

/** Something another module needs the desk to raise with a member the next time they are in touch,
 *  shown as a badge on their swimmer profile: "Payment failed", "September direct debit not
 *  recovered yet". A short label and hint only, never amounts or notes; the link opens the record
 *  in its own module, which checks permission again. */
export type MemberNotice = { id: string; label: string; hint: string; href: string; module: string };
export type MemberNoticeSource = { id: string; /** The app it belongs to (its manifest id). */ app: string; list(memberId: string): Promise<MemberNotice[]> };
const memberNoticeSources: MemberNoticeSource[] = [];

export function registerMemberNotices(source: MemberNoticeSource) {
  const at = memberNoticeSources.findIndex((s) => s.id === source.id);
  if (at >= 0) memberNoticeSources[at] = source;
  else memberNoticeSources.push(source);
}

/** Every module's notices for this member. A failing source, or one whose app is off, is left out. */
export async function memberNoticesFor(memberId: string): Promise<MemberNotice[]> {
  await modulesLoaded();
  const lists = await Promise.all(memberNoticeSources.map(async (s) => !(await appOn(s.app)) ? [] : s.list(memberId).catch((error) => {
    console.error(`Member notices from ${s.id} failed`, error);
    return [] as MemberNotice[];
  })));
  return lists.flat();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** Announce an event once every module has registered its listeners (AGENTS.md, How apps talk), so a
 *  listener in a module the emitting page never loaded still hears it. Call it after the change
 *  is saved; a listener's failure is logged and never reaches the caller. A listener whose app is
 *  switched off at the event's site (its payload's `siteId`; anywhere, without one) does not run. */
export async function announce<K extends EventName>(name: K, payload: PlatformEvents[K]): Promise<void> {
  await modulesLoaded();
  const where = payload as { orgId?: unknown; siteId?: unknown };
  const orgId = typeof where.orgId === "string" ? where.orgId : null;
  const siteId = typeof where.siteId === "string" ? where.siteId : null;
  await emit(name, payload, (app) => appOn(app, { orgId, siteId }));
}

// ---------------------------------------------------------------------------
// Swimming courses in the parents app
// ---------------------------------------------------------------------------

/** A swimming course people book in the parents app (owner decisions, 21 October 2026): a Pool
 *  short course Manage ticked "Show in the parents app", until its first session. A minimum age of
 *  18 or more is an adult course; the rest are booked by parents for a child. Short courses owns
 *  the courses and registers them; the swim school's parent API lists and holds through this, so
 *  it never reads short-course tables. Never staff names, other people or notes. */
export type AppCourse = {
  id: string;
  name: string;
  description: string;
  site: { id: string; name: string; phone: string };
  minAge: number | null;
  priceCents: number;
  /** "€60", or "Free". */
  price: string;
  placesLeft: number;
  /** ISO dates. */
  firstDay: string;
  lastDay: string;
  sessions: { date: string; start: string; end: string; place: string }[];
};
/** Holding a place for one swimmer: payment owed, the desk phones within 72 hours. */
export type AppCourseHold = {
  courseId: string;
  swimmerId: string;
  /** The person taking the course, as on their swimmer record. */
  name: string;
  /** ISO date, for the minimum age. */
  dateOfBirth: string | null;
  /** The account's email and phone: who the desk phones. */
  email: string;
  phone: string;
  callTimes: string[];
  note: string;
  /** Who booked it, for the audit log: "Sam Doyle (parents app)". */
  by: string;
};
export type AppCourseHeld = { reference: string; callBy: string; course: string; site: string; firstDay: string; price: string };
/** One swimmer's place on an app course, for "My courses". */
export type AppCourseBooking = {
  id: string;
  courseId: string;
  swimmerId: string;
  name: string;
  site: string;
  reference: string | null;
  /** to-pay: held, the desk phones; booked: paid or no charge; done; withdrawn; cancelled. */
  state: "to-pay" | "booked" | "waiting" | "done" | "withdrawn" | "cancelled";
  firstDay: string | null;
  lastDay: string | null;
  sessions: number;
  next: { date: string; start: string; end: string; place: string } | null;
  /** Sessions with a register taken, and how many of those they were at. */
  marked: number;
  attended: number;
  price: string;
  callBy: string | null;
};
/** Thrown for anything the person can fix or should be told, with an API code. */
export class AppCourseError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
export type AppCourses = {
  /** The app that keeps the courses (its manifest id). */
  app: string;
  list(): Promise<AppCourse[]>;
  one(id: string): Promise<AppCourse | null>;
  /** Runs inside the caller's transaction, so a swimmer made for the booking goes with it. */
  hold(tx: Prisma.TransactionClient, input: AppCourseHold): Promise<AppCourseHeld>;
  /** Places on swimming courses for these swimmers (booked in the app or at the desk), newest first. */
  bookingsFor(swimmerIds: readonly string[]): Promise<AppCourseBooking[]>;
};

let appCourseSource: AppCourses | null = null;

export function registerAppCourses(source: AppCourses) {
  appCourseSource = source;
}

/** The parents app's courses, or null when Short courses is switched off. A course at a site
 *  where it is off is not listed and cannot be opened, so it is never held: a hold opens the
 *  course with `one` first, outside its transaction. */
export async function appCourses(): Promise<AppCourses | null> {
  await modulesLoaded();
  const source = appCourseSource;
  if (!source || !(await appOn(source.app))) return null;
  const one = async (id: string) => {
    const course = await source.one(id);
    return course && (await appOn(source.app, { siteId: course.site.id })) ? course : null;
  };
  return {
    ...source,
    list: async () => onlyWhereOn(source.app, await source.list(), (course) => course.site.id),
    one,
  };
}

// ---------------------------------------------------------------------------
// Renewing a qualification
// ---------------------------------------------------------------------------

/** The course that renews a qualification someone holds, for one person and qualification type:
 *  whether they already have it open, and whether the reader may assign it to them. */
export type QualificationRenewal = { courseId: string; title: string; assigned: boolean; canAssign: boolean };
/** An app whose courses give qualifications (Training) says which of them renews each, and assigns
 *  one. The expiring list asks (D26); the app checks its own permission to assign, writes and
 *  audits, and never learns why it was asked. */
export type QualificationRenewals = {
  /** The app it belongs to (its manifest id). */
  app: string;
  find(orgId: string | null, rows: readonly { userId: string; typeId: string }[]): Promise<(row: { userId: string; typeId: string }) => QualificationRenewal | null>;
  /** Assigns the course to one person, due on `dueOn` (YYYY-MM-DD) or with no due date (""). */
  assign(courseId: string, userId: string, dueOn: string): Promise<{ ok: true } | { ok: false; error: string }>;
};

let qualificationRenewalSource: QualificationRenewals | null = null;

export function registerQualificationRenewals(source: QualificationRenewals) {
  qualificationRenewalSource = source;
}

/** The courses that renew qualifications, or null when no app offers them or it is switched off:
 *  the expiring list then offers no course. The caller has already checked its own permission for
 *  the people it asks about. */
export async function qualificationRenewals(): Promise<QualificationRenewals | null> {
  await modulesLoaded();
  const source = qualificationRenewalSource;
  return source && (await appOn(source.app)) ? source : null;
}
