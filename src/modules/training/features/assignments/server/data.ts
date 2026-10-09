import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { qualificationState } from "@/lib/people/data";
import { requireCapFor, subjectsFor } from "@/lib/policy/session";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { OPEN_TRAINING_STATUSES, trainingState } from "@/modules/training/shared/constants";
import { expiringQualificationRows, scopedUserIds } from "@/modules/training/shared/data";

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
