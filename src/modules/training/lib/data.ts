import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { qualificationState } from "@/lib/people/data";
import { requirementStates } from "@/lib/people/requirements";
import { requireCapFor, subjectsFor } from "@/lib/policy/session";
import type { SubjectFilter } from "@/lib/policy/types";
import type { PermissionKey } from "@/lib/staff/permissions";
import { requireTrainingActor } from "@/modules/training/lib/access";
import { EXPIRY_WARNING_DAYS, OPEN_TRAINING_STATUSES, trainingState } from "@/modules/training/lib/constants";

/** Training reads. Every list of people's records is limited to the people
 *  the capability covers, resolved by the policy engine; the course catalogue
 *  is organisation data any Training user may read. */

const people = (filter: SubjectFilter): Prisma.StringFilter | undefined =>
  filter.kind === "all" ? undefined : { in: [...filter.userIds] };

async function scopedUserIds(cap: PermissionKey) {
  return people(await subjectsFor(cap));
}

function isoPlusDays(iso: string, days: number) {
  const date = parseDateOnly(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export async function listCourses(options: { archived?: boolean } = {}) {
  const who = await requireTrainingActor();
  const courses = await prisma.trainingCourse.findMany({
    where: { orgId: who.orgId ?? undefined, archivedAt: options.archived ? { not: null } : null },
    orderBy: { title: "asc" },
    select: { id: true, title: true, summary: true, content: true, requiresSignoff: true, archivedAt: true, grantsType: { select: { id: true, name: true, validityMonths: true } } },
  });
  return { who, courses };
}
export type CourseRow = Awaited<ReturnType<typeof listCourses>>["courses"][number];

export async function listQualificationTypeOptions() {
  const who = await requireTrainingActor();
  return prisma.qualificationType.findMany({ where: { orgId: who.orgId ?? undefined, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, validityMonths: true } });
}

/** Active people the signed-in person may assign training to. */
export async function assignablePeople() {
  const who = await requireTrainingActor();
  if (!who.assign) return [];
  return prisma.user.findMany({
    where: { orgId: who.orgId ?? undefined, isActive: true, id: await scopedUserIds("training.assign") },
    orderBy: { name: "asc" },
    // Their role, so a course can be given to everyone on a role at once.
    select: { id: true, name: true, jobTitle: true, staffRole: { select: { id: true, name: true } } },
  });
}

// ---------------------------------------------------------------------------
// Overview: open and recent assignments for the people in scope
// ---------------------------------------------------------------------------

export const OVERVIEW_VIEWS = {
  open: "Open training",
  overdue: "Overdue",
  submitted: "Awaiting sign-off",
  completed: "Completed in 30 days",
  all: "All training",
} as const;
export type OverviewView = keyof typeof OVERVIEW_VIEWS;

export async function trainingOverview(input: { view?: string; course?: string; q?: string }) {
  const who = await requireTrainingActor();
  const on = today();
  const view: OverviewView = input.view && input.view in OVERVIEW_VIEWS ? (input.view as OverviewView) : "open";
  const userId = await scopedUserIds("training.records.read");
  const scope: Prisma.TrainingAssignmentWhereInput = { orgId: who.orgId ?? undefined, userId };
  // "Completed" lists the same 30 days its tile counts.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const statusWhere: Prisma.TrainingAssignmentWhereInput =
    view === "open" ? { status: { in: [...OPEN_TRAINING_STATUSES] } }
    : view === "overdue" ? { status: "ASSIGNED", dueOn: { lt: parseDateOnly(on) } }
    : view === "submitted" ? { status: "SUBMITTED" }
    : view === "completed" ? { status: "COMPLETED", completedAt: { gte: since } }
    : {};
  const q = (input.q ?? "").trim().slice(0, 80);
  const where: Prisma.TrainingAssignmentWhereInput = {
    ...scope, ...statusWhere,
    ...(input.course ? { courseId: input.course } : {}),
    ...(q ? { user: { name: { contains: q, mode: "insensitive" } } } : {}),
  };
  const [rows, total, overdue, submitted, completed, expiring, courses] = await Promise.all([
    prisma.trainingAssignment.findMany({
      where, take: 100,
      orderBy: view === "completed" ? [{ completedAt: "desc" }] : [{ dueOn: { sort: "asc", nulls: "last" } }, { assignedAt: "asc" }],
      select: {
        id: true, status: true, dueOn: true, assignedAt: true, completedAt: true, signedOffByName: true,
        course: { select: { id: true, title: true, requiresSignoff: true } },
        user: { select: { id: true, name: true, jobTitle: true } },
      },
    }),
    prisma.trainingAssignment.count({ where }),
    prisma.trainingAssignment.count({ where: { ...scope, status: "ASSIGNED", dueOn: { lt: parseDateOnly(on) } } }),
    prisma.trainingAssignment.count({ where: { ...scope, status: "SUBMITTED" } }),
    prisma.trainingAssignment.count({ where: { ...scope, status: "COMPLETED", completedAt: { gte: since } } }),
    expiringQualificationRows(who.orgId, userId, on).then((r) => r.length),
    prisma.trainingCourse.findMany({ where: { orgId: who.orgId ?? undefined }, orderBy: { title: "asc" }, select: { id: true, title: true, archivedAt: true } }),
  ]);
  return {
    who, view, courses, total,
    counts: { overdue, submitted, completed, expiring },
    rows: rows.map((row) => ({ ...row, state: trainingState(row, on) })),
  };
}
export type OverviewRow = Awaited<ReturnType<typeof trainingOverview>>["rows"][number];

// ---------------------------------------------------------------------------
// Sign-off queue
// ---------------------------------------------------------------------------

/** Submitted practical work this person may sign off: people in their reach, never themselves. */
async function signoffWhere(who: { id: string; orgId: string | null }): Promise<Prisma.TrainingAssignmentWhereInput> {
  return { orgId: who.orgId ?? undefined, status: "SUBMITTED", userId: { ...(await scopedUserIds("training.signoff")), not: who.id } };
}

/** How many wait for this person's sign-off, for the home page: a count, no names. */
export async function signoffCount() {
  const who = await requireTrainingActor();
  if (!who.signoff) return 0;
  return prisma.trainingAssignment.count({ where: await signoffWhere(who) });
}

export async function signoffQueue() {
  const who = await requireTrainingActor();
  if (!who.signoff) return { who, rows: [] };
  const rows = await prisma.trainingAssignment.findMany({
    where: await signoffWhere(who),
    orderBy: { submittedAt: "asc" },
    select: {
      id: true, submittedAt: true, learnerNote: true, dueOn: true,
      course: { select: { title: true, summary: true, grantsType: { select: { name: true } } } },
      user: { select: { id: true, name: true, jobTitle: true } },
    },
  });
  return { who, rows };
}

// ---------------------------------------------------------------------------
// Expiring qualifications, with the course that renews each
// ---------------------------------------------------------------------------

/** Who a filtered list covers: at a site (or every site), in a position. */
export type ExpiringFilters = { site?: string; position?: string };
const filteredPeople = (f: ExpiringFilters): Prisma.UserWhereInput => ({
  isActive: true,
  ...(f.site ? { OR: [{ siteIds: { has: f.site } }, { siteIds: { isEmpty: true } }] } : {}),
  ...(f.position ? { positionId: f.position } : {}),
});

async function expiringQualificationRows(orgId: string | null, userId: Prisma.StringFilter | undefined, on: string, filters: ExpiringFilters = {}) {
  const horizon = parseDateOnly(isoPlusDays(on, EXPIRY_WARNING_DAYS));
  const rows = await prisma.qualification.findMany({
    where: { orgId: orgId ?? undefined, userId, revokedAt: null, expiresOn: { lte: horizon }, user: filteredPeople(filters) },
    orderBy: { expiresOn: "asc" },
    select: { id: true, userId: true, typeId: true, expiresOn: true, revokedAt: true, type: { select: { name: true } }, user: { select: { name: true, jobTitle: true } } },
  });
  if (rows.length === 0) return [];
  // A newer certificate of the same type replaces an expiring one.
  const newer = await prisma.qualification.findMany({
    where: { userId: { in: [...new Set(rows.map((r) => r.userId))] }, typeId: { in: [...new Set(rows.map((r) => r.typeId))] }, revokedAt: null, OR: [{ expiresOn: null }, { expiresOn: { gt: horizon } }] },
    select: { userId: true, typeId: true },
  });
  const renewed = new Set(newer.map((q) => `${q.userId}:${q.typeId}`));
  return rows.filter((r) => !renewed.has(`${r.userId}:${r.typeId}`));
}

/** Expired and expiring qualifications for the people this person covers, filtered by site and
 *  position; and (owner decision, 8 October 2026) who lacks a qualification their position needs. */
export async function expiringQualifications(filters: ExpiringFilters = {}) {
  const who = await requireTrainingActor();
  const on = today();
  const scope = await scopedUserIds("training.records.read");
  const [rows, sites, positions, holders] = await Promise.all([
    expiringQualificationRows(who.orgId, scope, on, filters),
    prisma.club.findMany({ where: { orgId: who.orgId ?? undefined, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.position.findMany({ where: { orgId: who.orgId ?? undefined, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { orgId: who.orgId ?? undefined, id: scope, ...filteredPeople(filters), position: { requires: { some: {} } } },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, position: { select: { name: true, requires: { select: { type: { select: { id: true, name: true } } } } } },
        qualifications: { select: { typeId: true, issuedOn: true, expiresOn: true, revokedAt: true } },
      },
    }),
  ]);
  // Never held at all: expired and expiring ones are already in the list above.
  const missing = holders.flatMap((p) => {
    const lacking = requirementStates(p.position!.requires.map((r) => r.type), p.qualifications, on).filter((r) => r.state === "missing");
    return lacking.length ? [{ userId: p.id, name: p.name, position: p.position!.name, lacking: lacking.map((r) => r.name) }] : [];
  });
  const courses = await prisma.trainingCourse.findMany({
    where: { orgId: who.orgId ?? undefined, archivedAt: null, grantsTypeId: { in: [...new Set(rows.map((r) => r.typeId))] } },
    select: { id: true, title: true, grantsTypeId: true },
  });
  const open = await prisma.trainingAssignment.findMany({
    where: { userId: { in: [...new Set(rows.map((r) => r.userId))] }, courseId: { in: courses.map((c) => c.id) }, status: { in: [...OPEN_TRAINING_STATUSES] } },
    select: { userId: true, courseId: true },
  });
  const assigned = new Set(open.map((a) => `${a.userId}:${a.courseId}`));
  const assignScope = who.assign ? await subjectsFor("training.assign") : null;
  return {
    who, sites, positions, missing,
    rows: rows.map((r) => {
      const course = courses.find((c) => c.grantsTypeId === r.typeId) ?? null;
      return {
        id: r.id, userId: r.userId, name: r.user.name, jobTitle: r.user.jobTitle, qualification: r.type.name,
        expiresOn: r.expiresOn, state: qualificationState(r, on),
        renewal: course ? {
          courseId: course.id, title: course.title, assigned: assigned.has(`${r.userId}:${course.id}`),
          canAssign: !!assignScope && (assignScope.kind === "all" || assignScope.userIds.has(r.userId)),
        } : null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// One person's training record
// ---------------------------------------------------------------------------

export async function personTraining(userId: string) {
  const who = await requireTrainingActor();
  const person = await prisma.user.findFirst({ where: { id: userId, orgId: who.orgId ?? undefined }, select: { id: true, name: true, jobTitle: true } });
  if (!person) notFound();
  try {
    await requireCapFor("training.records.read", { subjectUserId: userId, orgId: who.orgId });
  } catch {
    notFound();
  }
  const on = today();
  const [assignments, qualifications] = await Promise.all([
    prisma.trainingAssignment.findMany({
      where: { userId },
      orderBy: [{ assignedAt: "desc" }],
      select: {
        id: true, status: true, dueOn: true, assignedAt: true, assignedByName: true, submittedAt: true, completedAt: true,
        signedOffByName: true, signoffNote: true, learnerNote: true, cancelReason: true,
        course: { select: { id: true, title: true, requiresSignoff: true } },
      },
    }),
    prisma.qualification.findMany({
      where: { userId },
      orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { expiresOn: { sort: "asc", nulls: "last" } }],
      select: { id: true, issuedOn: true, expiresOn: true, revokedAt: true, reference: true, type: { select: { name: true } } },
    }),
  ]);
  const assignScope = who.assign ? await subjectsFor("training.assign") : null;
  return {
    who, person,
    canAssign: !!assignScope && (assignScope.kind === "all" || assignScope.userIds.has(userId)),
    assignments: assignments.map((a) => ({ ...a, state: trainingState(a, on) })),
    qualifications: qualifications.map((q) => ({ ...q, state: qualificationState(q, on) })),
  };
}
