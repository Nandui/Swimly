/** Every mutation is audited — including the ones a script performs.
 *
 *  The rule is worth stating because the temptation to skip it always arrives
 *  disguised: a bulk import, a one-off fix, a migration script. If a row
 *  changed and the log does not say so, the log is no longer answerable, and
 *  an audit trail nobody trusts is worse than none.
 *
 *  `summary` is the whole point. It is written for a person reading the log
 *  months later, so it names what changed and to what — "email old → new", not
 *  "user updated". Diff old against new and say which fields moved. */

import { Prisma } from "@/generated/prisma/client";
import { SCHOOL_TIMEZONE } from "@/lib/format";
import { currentClubIdIfAny } from "@/lib/clubs/current";
import type { SiteFilter } from "@/lib/policy/types";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorId?: string | null;
  /** Denormalised on purpose: the log must still read correctly after the
   *  actor's account is deleted. */
  actorName: string;
  action: string; // "create" | "update" | "delete", or a domain verb
  entity: string; // the model name, e.g. "Student"
  entityId?: string | null;
  /** How the log is filtered, because it is how the app is navigated. A plain
   *  nullable String rather than a foreign key, for the same reason
   *  `actorName` is denormalised: the log must survive the programme. */
  programmeId?: string | null;
  /** Which site it happened in. Timetable and enrolment actions pass the
   *  actual class/session site, which may differ from the working area.
   *  Shared record edits use null so they appear at every site. */
  clubId?: string | null;
  /** The module's log name. Normally left out: it follows from `entity`
   *  (`MODULE_OF_ENTITY`). */
  module?: string;
  summary: string;
  details?: Prisma.InputJsonValue;
};

/** Which module each record type belongs to, by the module's log name in
 *  `src/modules/registry.ts`. One place, so every entry in the shared log
 *  names its module the same way; a test fails if an audited record type is
 *  missing here. */
export const MODULE_OF_ENTITY: Readonly<Record<string, string>> = {
  // Admin: people, roles, sites and devices.
  User: "Admin", StaffRole: "Admin", RoleAssignment: "Admin", Club: "Admin", Department: "Admin", Organisation: "Admin", SharedDevice: "Admin",
  // Swim school.
  Student: "Swim school", Enrolment: "Swim school", Course: "Swim school", LegendAgreementPrice: "Swim school", Programme: "Swim school", Level: "Swim school", Competency: "Swim school",
  AssessmentType: "Swim school", AssessmentSession: "Swim school", AssessmentBooking: "Swim school",
  ParentAccount: "Swim school", ParentSignInChallenge: "Swim school", ParentChildAccess: "Swim school", ParentAccessRequest: "Swim school",
  ParentChangeRequest: "Swim school", ParentAssessmentPublication: "Swim school",
  // Training, including the qualifications it keeps.
  TrainingCourse: "Training", TrainingAssignment: "Training", TrainingRule: "Training", TrainingEvidence: "Training", TrainingPath: "Training", TrainingPathEnrolment: "Training", TrainingSession: "Training", TrainingHours: "Training", TrainingHourTarget: "Training", Qualification: "Training", QualificationType: "Training", QualificationEvidence: "Training",
  // Refunds and Rota.
  RefundRequest: "Refunds", RefundNotification: "Refunds",
  CoinageRequest: "Coinage", CoinageNotification: "Coinage",
  AcademyCourseType: "Short courses", AcademyCourse: "Short courses", AcademySession: "Short courses", AcademyCandidate: "Short courses", AcademyCall: "Short courses",
  Supplier: "Purchasing", PurchaseProduct: "Purchasing", PurchaseApprovalRule: "Purchasing", PurchaseOrder: "Purchasing", PurchasingSettings: "Purchasing",
  TaskTemplate: "Tasks", Task: "Tasks", TaskAction: "Tasks", TaskSite: "Tasks",
  IncidentReport: "Incidents", IncidentsSettings: "Incidents",
  StockCategory: "Stock", StockProduct: "Stock", StockTake: "Stock", StockTakeLine: "Stock",
  CctvViewing: "CCTV log", CctvViewingNote: "CCTV log",
  MonitoringAction: "Site Monitoring",
  ShortCourseType: "Short courses", ShortCourse: "Short courses", ShortCourseSession: "Short courses", ShortCourseParticipant: "Short courses",
  ActivityType: "Admin", SiteArea: "Admin", Position: "Admin",
  RotaShift: "Rota", RotaDayNote: "Rota", RotaActivity: "Rota", RotaAbsence: "Rota", RotaImport: "Rota", RotaDepartment: "Rota",
  RotaNeed: "Rota", RotaAssignment: "Rota", RotaAreaAssignment: "Rota", RotaWeekShare: "Rota", RotaLog: "Rota", RotaRepeat: "Rota", RotaActivityType: "Rota", RotaPlanShift: "Rota", RotaBreak: "Rota", RotaBookingKind: "Rota",
  // Planned from the rota, kept by the swim school.
  ClassPlannedTeacher: "Swim school",
};

/** Rows that belong to no club, so their audit entries belong to none either
 *  and show up in every club's activity. */
// Organisation-level records (People core) belong to no single site either.
const SHARED_ENTITIES = new Set(["User", "StaffRole", "Student", "Programme", "Level", "Competency", "AssessmentType", "Organisation", "Department", "RoleAssignment", "QualificationType", "Qualification", "SharedDevice", "TrainingCourse", "TrainingAssignment", "TrainingRule", "TrainingEvidence", "TrainingPath", "TrainingPathEnrolment", "TrainingSession", "TrainingHours", "TrainingHourTarget", "RotaAbsence", "RotaImport", "RotaDepartment", "Supplier", "PurchaseProduct", "PurchaseApprovalRule", "PurchasingSettings", "IncidentsSettings", "StockCategory", "StockProduct", "ActivityType", "Position"]);

/** @param db Pass the transaction client when the audit row must live or die
 *  with the write it describes. The default writes on its own connection,
 *  which is what you want after a locked transaction has already committed —
 *  but inside `$transaction` it would escape the rollback and leave the log
 *  describing a change that never happened. */
export async function logAudit(
  input: AuditInput,
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  const clubId =
    input.clubId !== undefined
      ? input.clubId
      : SHARED_ENTITIES.has(input.entity)
        ? null
        : await currentClubIdIfAny();

  const moduleName = input.module ?? MODULE_OF_ENTITY[input.entity] ?? null;
  await db.auditLog.create({ data: { ...input, clubId, module: moduleName } });
}

/** Which of these audited actions were recorded for these records, e.g. to
 *  tell a withdrawn waitlist from a withdrawn class place. Returns
 *  `{ entityId, action }` pairs only, never summaries or details. */
export async function auditedActions(entity: string, entityIds: readonly string[], actions: readonly string[]) {
  if (entityIds.length === 0) return [];
  const rows = await prisma.auditLog.findMany({
    where: { entity, entityId: { in: [...entityIds] }, action: { in: [...actions] } },
    select: { entityId: true, action: true },
  });
  return rows.filter((row): row is { entityId: string; action: string } => row.entityId !== null);
}

/** One module's audit trail, newest first, a page at a time: the rows at the
 *  sites a capability reaches, plus the organisation-wide ones (no site). For
 *  a module's own activity screen; the caller has checked the permission. */
export async function moduleAuditTrail(module: string, sites: SiteFilter, page: { skip: number; take: number }) {
  const where: Prisma.AuditLogWhereInput = {
    module,
    ...(sites.kind === "all" ? {} : { OR: [{ clubId: { in: [...sites.siteIds] } }, { clubId: null }] }),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take, select: { id: true, actorName: true, action: true, summary: true, createdAt: true, clubId: true } }),
    prisma.auditLog.count({ where }),
  ]);
  return { rows, total };
}

/** The audit trail of some records of one type, oldest first (the latest `take`): who did what and when. For an
 *  audit pack of a person's or a course's records; the caller has checked the reader may see them. */
export async function auditTrailFor(entity: string, entityIds: readonly string[], take = 1000) {
  if (entityIds.length === 0) return [];
  const rows = await prisma.auditLog.findMany({
    where: { entity, entityId: { in: [...entityIds] } },
    orderBy: { createdAt: "desc" }, take,
    select: { id: true, entityId: true, actorName: true, action: true, summary: true, createdAt: true },
  });
  return rows.reverse();
}

/** Who did how much, from the log: entries grouped by person, module, record type, action, site, local
 *  day and hour, between two local dates (Europe/Dublin, both inclusive). For a manager's view of the work
 *  done in some modules; counts only, never summaries. `siteIds` null means every site; otherwise the
 *  entries at those sites plus the organisation-wide ones (no site), which belong to every site. The caller
 *  has checked the reader may see this work. */
export type AuditWorkRow = { actorId: string | null; actorName: string; module: string | null; entity: string; action: string; clubId: string | null; day: string; hour: number; count: number };
export async function auditWorkload(query: { modules: readonly string[]; siteIds: readonly string[] | null; from: string; to: string }): Promise<AuditWorkRow[]> {
  if (query.modules.length === 0 || query.siteIds?.length === 0) return [];
  const local = Prisma.sql`(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${SCHOOL_TIMEZONE})`;
  return prisma.$queryRaw<AuditWorkRow[]>(Prisma.sql`
    SELECT "actorId", "actorName", module, entity, action, "clubId",
      ${local}::date::text AS day, EXTRACT(HOUR FROM ${local})::int AS hour, COUNT(*)::int AS count
    FROM "AuditLog"
    WHERE module IN (${Prisma.join([...query.modules])})
      AND ${local}::date BETWEEN ${query.from}::date AND ${query.to}::date
      ${query.siteIds ? Prisma.sql`AND ("clubId" IS NULL OR "clubId" IN (${Prisma.join([...query.siteIds])}))` : Prisma.empty}
    GROUP BY "actorId", "actorName", module, entity, action, "clubId", day, hour`);
}

/** When each of some audited actions happened to records of one type, between two local dates
 *  (Europe/Dublin, inclusive): who, where and when, never summaries. For timing work (how long a place
 *  stood before it was undone). Site filtering as in `auditWorkload`. */
export type AuditEventRow = { entityId: string; action: string; actorId: string | null; actorName: string; clubId: string | null; at: Date };
export async function auditEvents(query: { entity: string; actions: readonly string[]; siteIds: readonly string[] | null; from: string; to: string }): Promise<AuditEventRow[]> {
  if (query.actions.length === 0 || query.siteIds?.length === 0) return [];
  const local = Prisma.sql`(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${SCHOOL_TIMEZONE})`;
  return prisma.$queryRaw<AuditEventRow[]>(Prisma.sql`
    SELECT "entityId", action, "actorId", "actorName", "clubId", "createdAt" AS at
    FROM "AuditLog"
    WHERE entity = ${query.entity} AND action IN (${Prisma.join([...query.actions])}) AND "entityId" IS NOT NULL
      AND ${local}::date BETWEEN ${query.from}::date AND ${query.to}::date
      ${query.siteIds ? Prisma.sql`AND ("clubId" IS NULL OR "clubId" IN (${Prisma.join([...query.siteIds])}))` : Prisma.empty}
    ORDER BY "createdAt"`);
}
