import "server-only";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { activeStaffIds, contractMinutesByIds, liveSiteById, liveSitesWithin, staffAgesByIds, staffByIds } from "@/lib/directory";
import { toDateOnlyString, today } from "@/lib/format";
import { currentActor, mayFor, sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { qualificationsHeldBy } from "@/lib/qualifications";
import type { PermissionKey } from "@/lib/staff/permissions";
import { requireStaffingActor } from "@/modules/staffing/shared/access";
import {
  readSettings, semesterOf, strikeCounted, strikeDue, strikeStage, type ContractKind, type StaffingSettings, type StrikeCause,
} from "@/modules/staffing/shared/rules";

/** What Staffing's reads and writes share: the pages to refresh, access at a site, the settings,
 *  the sites a person covers, the pool staff and recording a strike. */

type Db = Prisma.TransactionClient | typeof prisma;

export function refresh(...paths: string[]) {
  for (const path of ["/staffing", "/staffing/overview", "/staffing/today", "/staffing/requests", "/staffing/strikes", ...paths]) revalidatePath(path);
}

const REFUSALS: Partial<Record<PermissionKey, string>> = {
  "staffing.run": "This needs Staffing Run at this site.",
  "staffing.supervise": "This needs Staffing Supervise at this site.",
  "staffing.manage": "This needs Staffing Manage at this site.",
};

export type SiteActor = { id: string; name: string; orgId: string };

/** The signed-in person, if they hold `cap` at the site. */
export async function atSite(siteId: string, cap: PermissionKey) {
  const site = await liveSiteById(siteId);
  if (!site?.orgId) return { ok: false as const, error: "That site is not open." };
  if (!(await mayFor(cap, { siteId, orgId: site.orgId }))) return { ok: false as const, error: REFUSALS[cap] ?? "This needs Staffing access at this site." };
  const actor = await currentActor();
  return { ok: true as const, actor: { id: actor.id, name: actor.name, orgId: site.orgId } satisfies SiteActor, site: { id: site.id, name: site.name } };
}

export async function settingsFor(orgId: string | null, db: Db = prisma): Promise<StaffingSettings> {
  if (!orgId) return readSettings(null);
  const row = await db.staffingSettings.findUnique({ where: { orgId }, select: { values: true } });
  return readSettings(row?.values ?? null);
}

/** The sites the person sees in Staffing, each with what they may do there. */
export async function staffingSites() {
  const who = await requireStaffingActor();
  const [read, run, supervise, manage] = await Promise.all([
    sitesFor("staffing.read"), who.run ? sitesFor("staffing.run") : null, who.supervise ? sitesFor("staffing.supervise") : null, who.manage ? sitesFor("staffing.manage") : null,
  ]);
  const holds = (s: Awaited<ReturnType<typeof sitesFor>> | null, id: string) => !!s && (s.kind === "all" || s.siteIds.has(id));
  const sites = await liveSitesWithin(who.orgId, read);
  return { who, sites: sites.map((s) => ({ ...s, run: holds(run, s.id), supervise: holds(supervise, s.id), manage: holds(manage, s.id) })) };
}
export type StaffingSite = Awaited<ReturnType<typeof staffingSites>>["sites"][number];

/** The page's site: `?site=` when the person covers it, else their first. */
export async function pickSite(siteId: string | undefined) {
  const { who, sites } = await staffingSites();
  const site = siteId ? sites.find((s) => s.id === siteId) : sites[0];
  if (siteId && !site) notFound();
  return { who, sites, site: site ?? null };
}

/** Everyone on the Staffing rota (swim teachers and lifeguards) who is still active, with what the warnings need:
 *  contract, college, contracted minutes, date of birth and qualifications. */
export async function poolStaff(orgId: string | null, db: Db = prisma) {
  const rows = await db.staffingTeacher.findMany({ where: { orgId: orgId ?? undefined } });
  const active = await activeStaffIds(rows.map((r) => r.userId));
  const kept = rows.filter((r) => active.has(r.userId));
  const ids = kept.map((r) => r.userId);
  const [names, ages, contracts, quals] = await Promise.all([staffByIds(ids), staffAgesByIds(ids), contractMinutesByIds(ids), qualificationsHeldBy(ids)]);
  const dob = new Map(ages.map((a) => [a.id, a.dateOfBirth]));
  return kept.map((r) => ({
    id: r.userId,
    name: names.get(r.userId)?.name ?? "Someone",
    college: r.college,
    contract: r.contract as ContractKind,
    wantsMore: r.wantsMore,
    contractMinutes: contracts.get(r.userId) ?? null,
    dateOfBirth: dob.get(r.userId) ? toDateOnlyString(dob.get(r.userId)!) : null,
    quals: quals.filter((q) => q.userId === r.userId && !q.revokedAt).map((q) => ({ typeId: q.typeId, expiresOn: q.expiresOn ? toDateOnlyString(q.expiresOn) : null })),
  })).sort((a, b) => a.name.localeCompare(b.name));
}
export type PoolStaff = Awaited<ReturnType<typeof poolStaff>>[number];

/** Every shift these people have between two days, at any site, for the warnings. */
export async function shiftsOf(userIds: readonly string[], from: string, to: string, db: Db = prisma) {
  if (userIds.length === 0) return [];
  const rows = await db.staffingShift.findMany({
    where: { userId: { in: [...userIds] }, date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) }, status: { in: ["scheduled", "late"] } },
    select: { id: true, userId: true, date: true, startMin: true, endMin: true, role: true, siteId: true },
  });
  return rows.map((r) => ({ id: r.id, userId: r.userId!, date: toDateOnlyString(r.date), startMin: r.startMin, endMin: r.endMin, role: r.role, siteId: r.siteId }));
}

/** Counted strikes this semester, by person. */
export async function strikeCounts(userIds: readonly string[], day = today(), db: Db = prisma) {
  if (userIds.length === 0) return new Map<string, number>();
  const rows = await db.staffingStrike.groupBy({ by: ["userId"], where: { userId: { in: [...userIds] }, semester: semesterOf(day).key, counted: true, withdrawnAt: null }, _count: true });
  return new Map(rows.map((r) => [r.userId, r._count]));
}

/** Record a strike in the caller's transaction: its number this semester, its stage and when its
 *  owner's step is due (BR-8.3 to 8.5). Returns its id and stage. */
export async function recordStrike(tx: Prisma.TransactionClient, input: {
  orgId: string; siteId: string; userId: string; cause: StrikeCause; occurredOn: string; sourceId: string | null; settings: StaffingSettings; actor: { id: string; name: string }; personName: string;
}) {
  const semester = semesterOf(input.occurredOn).key;
  const counted = strikeCounted(input.occurredOn, input.settings);
  const before = counted ? await tx.staffingStrike.count({ where: { userId: input.userId, semester, counted: true, withdrawnAt: null } }) : 0;
  const number = counted ? before + 1 : 0;
  const stage = strikeStage(number, input.cause, counted);
  const next = await tx.staffingShift.findFirst({
    where: { userId: input.userId, date: { gt: new Date(`${input.occurredOn}T00:00:00Z`) }, status: "scheduled" }, orderBy: [{ date: "asc" }, { startMin: "asc" }], select: { date: true },
  });
  const dueOn = strikeDue(stage, input.occurredOn, next ? toDateOnlyString(next.date) : null, input.settings);
  const row = await tx.staffingStrike.create({ data: {
    orgId: input.orgId, siteId: input.siteId, userId: input.userId, semester, number, cause: input.cause, sourceId: input.sourceId,
    occurredOn: new Date(`${input.occurredOn}T00:00:00Z`), stage, counted, dueOn: new Date(`${dueOn}T00:00:00Z`),
  } });
  await logAudit({ actorId: input.actor.id, actorName: input.actor.name, action: "create", entity: "StaffingStrike", entityId: row.id, clubId: input.siteId,
    summary: counted ? `Strike ${number} this semester for ${input.personName}` : `Logged a strike for ${input.personName} (settling in, not counted)` }, tx);
  return { id: row.id, stage, number };
}

export const dateOf = (iso: string) => new Date(`${iso}T00:00:00Z`);
