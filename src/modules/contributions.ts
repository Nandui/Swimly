import "server-only";
import { emit, type EventName, type PlatformEvents } from "@/platform/events";
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
 *  these return counts and short labels, never records. */

/** Loads every module's registrations (the composition root) before a module reads another's,
 *  as the platform registry loads the app's module list (CLAUDE.md, section 5). Modules call
 *  `personFile`, `subjectRecords`, `commitmentsFor` and `planCommitment` from here, so none of
 *  them imports the composition root; Core and front pages already load it through it. */
let modulesLoading: Promise<unknown> | undefined;
function modulesLoaded() {
  return (modulesLoading ??= import("@/modules/server"));
}

export type SiteSummary = {
  id: string;
  /** One short line per site, e.g. "3 programmes · 1,156 active swimmers". */
  lines(clubIds: string[]): Promise<Map<string, string>>;
};

const siteSummaries: SiteSummary[] = [];

export function registerSiteSummary(summary: SiteSummary) {
  if (!siteSummaries.some((s) => s.id === summary.id)) siteSummaries.push(summary);
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
  await modulesLoaded();
  return Promise.all(personFileSections.map(async (section) => ({ id: section.id, heading: section.heading, ...(await section.load(userId, orgId)) })));
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

/** Every registered module's records about this person, by key. */
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
  /** The person the source has on it when nothing is planned for the date (a class's instructor
   *  from before the rota chose them), so the rota can carry them over; null or missing for none. */
  usualUserId?: string | null;
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
  /** Plans many occurrences at once (every week of a class, carrying teachers over). */
  planMany?(input: CommitmentPlanMany): Promise<CommitmentPlanManyResult>;
};
/** Many occurrences at one site: each date's person, or nobody. `onlyUnplanned` leaves dates that
 *  already have someone planned as they are. Occurrences that no longer happen, have already
 *  started, or whose person has left are skipped, never refused. */
export type CommitmentPlanMany = { siteId: string; items: readonly { ref: string; date: string; userId: string | null }[]; by: { id: string; name: string }; onlyUnplanned?: boolean };
export type CommitmentPlanManyResult = { ok: true; planned: number; skipped: number } | { ok: false; error: string };

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
  const lists = await Promise.all(commitmentSources.filter((s) => s.id !== except).map((s) => s.list(query)));
  return lists.flat();
}

/** Plan who does one occurrence of another module's commitment (owner decision, 6 October 2026:
 *  Rota assigns swim teachers; the swim school keeps the record). */
export async function planCommitment(sourceId: string, input: CommitmentPlan) {
  await modulesLoaded();
  const source = commitmentSources.find((s) => s.id === sourceId);
  if (!source?.plan) return { ok: false as const, error: "That can no longer be planned from here." };
  return source.plan(input);
}

/** Plan many occurrences of another module's commitment at once (owner, 23 October 2026:
 *  instructors are assigned on the rota, every week of a class at a time). */
export async function planCommitments(sourceId: string, input: CommitmentPlanMany): Promise<CommitmentPlanManyResult> {
  await modulesLoaded();
  const source = commitmentSources.find((s) => s.id === sourceId);
  if (!source?.planMany) return { ok: false, error: "That can no longer be planned from here." };
  return source.planMany(input);
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
export type DeskMeasureSource = { id: string; list(query: DeskMeasureQuery): Promise<DeskMeasure[]> };
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
  const lists = await Promise.all(deskMeasureSources.filter((s) => s.id !== except).map((s) => s.list(query).catch((error) => {
    console.error(`Desk measures from ${s.id} failed`, error);
    failed.push(s.id);
    return [] as DeskMeasure[];
  })));
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
export type NewMember = {
  firstName: string; lastName: string; dateOfBirth: string; memberNumber: string;
  contactName: string; contactEmail: string; contactPhone: string;
  emergencyName: string; emergencyPhone: string; emergencyRelationship: string; medicalNotes: string;
};
export type MemberDirectory = {
  /** Every word must match a name, the member number, a contact's name, email or phone, or the
   *  date of birth (2015-03-04 or 4/3/2015). At most 20, best first. */
  search(q: string): Promise<MemberHit[]>;
  byIds(ids: readonly string[], options: { medical: boolean }): Promise<Map<string, Member>>;
  /** Adds them at a site, audited as added from the calling module. Refuses a person already on
   *  the records with the same name and date of birth, or a member number in use. */
  create(input: NewMember, context: { siteId: string; by: { id: string; name: string }; via: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
};

let memberDirectory: MemberDirectory | null = null;

export function registerMemberDirectory(directory: MemberDirectory) {
  memberDirectory = directory;
}

/** The swimmer records, or null when the swim school is switched off: callers then keep their own
 *  name-only entry. The caller has already checked its own permission for the person it serves. */
export async function members(): Promise<MemberDirectory | null> {
  await modulesLoaded();
  return memberDirectory;
}

/** What other modules hold about one member, for their swimmer profile: "Couch to 5k at
 *  Riverside", "6 Oct to 10 Nov · booked". Titles and dates only, never payment or notes. */
export type MemberHistoryEntry = { id: string; title: string; detail: string; /** ISO date it starts. */ on: string; module: string };
export type MemberHistorySource = { id: string; list(memberId: string): Promise<MemberHistoryEntry[]> };
const memberHistorySources: MemberHistorySource[] = [];

export function registerMemberHistory(source: MemberHistorySource) {
  const at = memberHistorySources.findIndex((s) => s.id === source.id);
  if (at >= 0) memberHistorySources[at] = source;
  else memberHistorySources.push(source);
}

/** Every module's entries for this member, newest first. A failing source is left out. */
export async function memberHistoryFor(memberId: string): Promise<MemberHistoryEntry[]> {
  await modulesLoaded();
  const lists = await Promise.all(memberHistorySources.map((s) => s.list(memberId).catch((error) => {
    console.error(`Member history from ${s.id} failed`, error);
    return [] as MemberHistoryEntry[];
  })));
  return lists.flat().sort((a, b) => b.on.localeCompare(a.on));
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** Announce an event once every module has registered its listeners (CLAUDE.md section 6), so a
 *  listener in a module the emitting page never loaded still hears it. Call it after the change
 *  is saved; a listener's failure is logged and never reaches the caller. */
export async function announce<K extends EventName>(name: K, payload: PlatformEvents[K]): Promise<void> {
  await modulesLoaded();
  await emit(name, payload);
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

/** The parents app's courses, or null when Short courses is switched off. */
export async function appCourses(): Promise<AppCourses | null> {
  await modulesLoaded();
  return appCourseSource;
}
