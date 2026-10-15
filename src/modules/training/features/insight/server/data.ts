import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { auditTrailFor } from "@/lib/audit";
import { activePlacedStaff, lineManagersOf, livePositionsOf, organisationChart, type PlacedStaff } from "@/lib/directory";
import { parseDateOnly, today } from "@/lib/format";
import { qualificationState } from "@/lib/people/data";
import { staffMember } from "@/lib/people/records";
import { requireCapFor, subjectsFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { qualificationsOf } from "@/lib/qualifications";
import { requireTrainingActor, type TrainingActor } from "@/modules/training/shared/access";
import { trainingState } from "@/modules/training/shared/constants";
import { readOutline } from "@/modules/training/shared/lessons";
import { readObservationRecord } from "@/modules/training/shared/on-the-job";
import { hoursOf, sessionsOf } from "@/modules/training/shared/on-the-job-reads";
import { audienceInWords, timingInWords } from "@/modules/training/shared/rules";
import {
  bestScore, daysBetween, dropOff, examStats, funnel, groupBy, isOverdue, lastActivity, percentOf, stageOf, summaryOf, timing, type LearnerFacts,
} from "@/modules/training/features/insight/compute";

/** Reads for Training insight (docs/training.md, e-learning phase 7): course analytics, the
 *  reports page and audit packs. Everything is limited to the people the reader's
 *  `training.records.read` covers, through the policy engine; ratings stay without names. */

export const PERIODS = [
  { id: "all", label: "All time", days: null },
  { id: "365", label: "Past year", days: 365 },
  { id: "90", label: "Past 90 days", days: 90 },
  { id: "30", label: "Past 30 days", days: 30 },
] as const;
export type InsightFilters = { site?: string; department?: string; period?: string };

const EVERY_SITE = "*";
const NO_MANAGER = "-";

/** The people the reader covers, narrowed to a site (people with no sites work at all of them)
 *  and a department. */
async function coveredPeople(who: TrainingActor, filters: InsightFilters) {
  const scope = await subjectsFor("training.records.read");
  const people = await activePlacedStaff(who.orgId, scope);
  return people.filter((p) => (!filters.site || !p.siteIds.length || p.siteIds.includes(filters.site)) && (!filters.department || p.departmentIds.includes(filters.department)));
}

function since(period?: string) {
  const days = PERIODS.find((p) => p.id === period)?.days ?? null;
  return days ? new Date(parseDateOnly(today()).getTime() - days * 86_400_000) : null;
}

const FACT_SELECT = {
  id: true, userId: true, courseId: true, status: true, assignedAt: true, dueOn: true, completedAt: true, submittedAt: true, versionId: true,
  signedOffByName: true, certificateCode: true,
  progress: { select: { lessonId: true, completedAt: true } },
  examAttempts: { where: { submittedAt: { not: null } }, orderBy: { number: "asc" }, select: { number: true, percent: true, passed: true, submittedAt: true } },
} as const satisfies Prisma.TrainingAssignmentSelect;

async function assignmentsWhere(where: Prisma.TrainingAssignmentWhereInput) {
  const rows = await prisma.trainingAssignment.findMany({ where, orderBy: { assignedAt: "desc" }, select: { ...FACT_SELECT, course: { select: { id: true, title: true } } } });
  return rows.map((r) => ({
    ...r,
    facts: { userId: r.userId, status: r.status, assignedAt: r.assignedAt, dueOn: r.dueOn, completedAt: r.completedAt,
      lessons: r.progress.map((p) => ({ lessonId: p.lessonId, at: p.completedAt })), attempts: r.examAttempts } satisfies LearnerFacts,
  }));
}

const siteKeys = (p: PlacedStaff | undefined) => (p?.siteIds.length ? p.siteIds : [EVERY_SITE]);
const siteLabel = (id: string, sites: Map<string, string>) => (id === EVERY_SITE ? "Every site" : sites.get(id) ?? "Closed site");
const sitesInWords = (p: PlacedStaff | undefined, sites: Map<string, string>) => siteKeys(p).map((id) => siteLabel(id, sites)).join(", ");
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

async function ratings(courseIds: string[]) {
  const rows = courseIds.length ? await prisma.trainingFeedback.groupBy({ by: ["courseId"], where: { courseId: { in: courseIds } }, _avg: { rating: true }, _count: { _all: true } }) : [];
  return new Map(rows.map((r) => [r.courseId, { average: r._avg.rating === null ? null : Math.round(r._avg.rating * 10) / 10, count: r._count._all }]));
}

/** One course's analytics: how far people get, where they stop, how long they take, how the exam
 *  goes, by site, and each learner. Null when there is no such course here. */
export async function courseInsight(courseId: string, filters: InsightFilters = {}) {
  const who = await requireTrainingActor();
  const course = await prisma.trainingCourse.findFirst({
    where: { id: courseId, orgId: who.orgId ?? undefined },
    select: { id: true, title: true, archivedAt: true, requiresSignoff: true, publishedVersionId: true, versions: { select: { id: true, number: true } } },
  });
  if (!course) return null;
  const [people, chart, version, rated] = await Promise.all([
    coveredPeople(who, filters),
    organisationChart(),
    course.publishedVersionId ? prisma.trainingCourseVersion.findUnique({ where: { id: course.publishedVersionId }, select: { outline: true } }) : null,
    ratings([course.id]),
  ]);
  const from = since(filters.period);
  const byId = new Map(people.map((p) => [p.id, p]));
  const all = await assignmentsWhere({ courseId, userId: { in: [...byId.keys()] }, ...(from ? { assignedAt: { gte: from } } : {}) });
  const rows = all.filter((r) => r.status !== "CANCELLED");
  const facts = rows.map((r) => r.facts);
  const outline = readOutline(version?.outline);
  const lessons = outline.sections.flatMap((s) => s.lessons.map((l) => ({ id: l.id, title: l.title, section: s.title, minutes: l.minutes })));
  const lessonIds = lessons.map((l) => l.id);
  const on = today();
  const sites = new Map(chart.sites.map((s) => [s.id, s.name]));
  const versionNumber = new Map(course.versions.map((v) => [v.id, v.number]));
  const stopped = dropOff(facts, lessonIds);
  const bySite = [...groupBy(rows, (r) => siteKeys(byId.get(r.userId))).entries()]
    .map(([id, group]) => ({ id, name: siteLabel(id, sites), ...summaryOf(group.map((g) => g.facts), on) }))
    .sort((a, b) => (a.id === EVERY_SITE ? 1 : b.id === EVERY_SITE ? -1 : a.name.localeCompare(b.name)));
  const order = (r: (typeof rows)[number]) => (isOverdue(r.facts, on) ? 0 : r.status === "ASSIGNED" ? 1 : r.status === "SUBMITTED" ? 2 : 3);
  return {
    who,
    course: { id: course.id, title: course.title, archived: !!course.archivedAt, requiresSignoff: course.requiresSignoff, published: !!version },
    filters, sites: chart.sites, departments: chart.departments,
    hasExam: !!outline.exam,
    minutes: lessons.reduce((n, l) => n + (l.minutes ?? 0), 0),
    funnel: funnel(facts, lessonIds),
    dropOff: { ...stopped, lessons: stopped.lessons.map((l) => ({ ...l, ...lessons.find((x) => x.id === l.lessonId)! })) },
    timing: timing(facts),
    exam: examStats(facts),
    overdue: facts.filter((f) => isOverdue(f, on)).length,
    cancelled: all.length - rows.length,
    rating: rated.get(course.id) ?? { average: null, count: 0 },
    bySite,
    learners: [...rows].sort((a, b) => order(a) - order(b) || (byId.get(a.userId)?.name ?? "").localeCompare(byId.get(b.userId)?.name ?? "")).map((r) => ({
      id: r.id, userId: r.userId, name: byId.get(r.userId)?.name ?? "Former staff", sites: sitesInWords(byId.get(r.userId), sites),
      stage: stageOf(r.facts, lessonIds.length, on), state: trainingState(r, on), overdue: isOverdue(r.facts, on),
      assignedAt: r.assignedAt, dueOn: r.dueOn, completedAt: r.completedAt, lastActivity: lastActivity(r.facts),
      best: bestScore(r.facts), attempts: r.examAttempts.length, version: r.versionId ? versionNumber.get(r.versionId) ?? null : null,
      days: r.completedAt ? daysBetween(r.assignedAt, r.completedAt) : null, signedOffByName: r.signedOffByName, certificateCode: r.status === "COMPLETED" ? r.certificateCode : null,
    })),
  };
}
export type CourseInsight = NonNullable<Awaited<ReturnType<typeof courseInsight>>>;

/** The reports page: open and overdue training for the people the reader covers, by site and by
 *  line manager, every overdue course by person, and each course's numbers. */
export async function trainingReport(filters: InsightFilters = {}) {
  const who = await requireTrainingActor();
  const people = await coveredPeople(who, filters);
  const byId = new Map(people.map((p) => [p.id, p]));
  const [chart, managers, rows] = await Promise.all([
    organisationChart(),
    lineManagersOf([...byId.keys()]),
    assignmentsWhere({ userId: { in: [...byId.keys()] }, status: { not: "CANCELLED" }, course: { orgId: who.orgId ?? undefined, archivedAt: null } }),
  ]);
  const on = today();
  const sites = new Map(chart.sites.map((s) => [s.id, s.name]));
  const managerOf = (userId: string) => managers.get(userId) ?? null;
  const open = rows.filter((r) => r.status === "ASSIGNED" || r.status === "SUBMITTED");
  const overdue = rows.filter((r) => isOverdue(r.facts, on));
  const daysLate = (r: (typeof rows)[number]) => daysBetween(r.dueOn!, parseDateOnly(on));
  const lines = (groups: Map<string, typeof rows>, label: (key: string) => string, last: string) => [...groups.entries()]
    .map(([key, group]) => {
      const late = group.filter((r) => isOverdue(r.facts, on));
      return {
        id: key, name: label(key), open: group.filter((r) => r.status !== "COMPLETED").length, overdue: late.length,
        people: new Set(late.map((r) => r.userId)).size, longest: late.length ? Math.max(...late.map(daysLate)) : 0,
      };
    })
    .filter((l) => l.open > 0)
    .sort((a, b) => (a.id === last ? 1 : b.id === last ? -1 : b.overdue - a.overdue || a.name.localeCompare(b.name)));
  const courseGroups = groupBy(rows, (r) => [r.courseId]);
  const rated = await ratings([...courseGroups.keys()]);
  const monthAgo = new Date(parseDateOnly(on).getTime() - 30 * 86_400_000);
  return {
    who, filters, sites: chart.sites, departments: chart.departments, people: people.length,
    totals: {
      open: open.length, overdue: overdue.length, awaitingSignoff: rows.filter((r) => r.status === "SUBMITTED").length,
      completedLately: rows.filter((r) => r.completedAt && r.completedAt >= monthAgo).length,
      inDate: percentOf(rows.length - overdue.length, rows.length),
    },
    bySite: lines(groupBy(open, (r) => siteKeys(byId.get(r.userId))), (id) => siteLabel(id, sites), EVERY_SITE),
    byManager: lines(groupBy(open, (r) => [managerOf(r.userId)?.id ?? NO_MANAGER]), (id) => (id === NO_MANAGER ? "No manager set" : [...managers.values()].find((m) => m?.id === id)?.name ?? "Former staff"), NO_MANAGER),
    overdue: overdue.sort((a, b) => daysLate(b) - daysLate(a)).map((r) => ({
      id: r.id, userId: r.userId, name: byId.get(r.userId)?.name ?? "Former staff", course: r.course, dueOn: r.dueOn!, daysLate: daysLate(r),
      sites: sitesInWords(byId.get(r.userId), sites), manager: managerOf(r.userId)?.name ?? null, stage: stageOf(r.facts, 0, on),
    })),
    courses: [...courseGroups.entries()].map(([id, group]) => ({ id, title: group[0].course.title, ...summaryOf(group.map((g) => g.facts), on), rating: rated.get(id) ?? null }))
      .sort((a, b) => b.overdue - a.overdue || a.title.localeCompare(b.title)),
  };
}
export type TrainingReport = Awaited<ReturnType<typeof trainingReport>>;

/** A person's audit pack: every course they were given with the version taught, each lesson they
 *  finished and when, every exam sitting, the practical sign-off, certificates and qualifications,
 *  hours and sessions, and the audit trail behind it. A 404 for anyone the reader does not cover. */
export async function personAuditPack(userId: string) {
  const who = await requireTrainingActor();
  const person = await staffMember(userId, who.orgId);
  if (!person) notFound();
  try {
    await requireCapFor("training.records.read", { subjectUserId: userId, orgId: who.orgId });
  } catch {
    notFound();
  }
  const [assignments, qualifications, hours, sessions, placed, chart] = await Promise.all([
    prisma.trainingAssignment.findMany({
      where: { userId }, orderBy: { assignedAt: "asc" },
      select: {
        ...FACT_SELECT, assignedByName: true, cancelledAt: true, cancelReason: true, signoffNote: true, observation: true,
        course: { select: { id: true, title: true } },
        evidence: { orderBy: { createdAt: "asc" }, select: { name: true, createdAt: true } },
        examAttempts: { orderBy: { number: "asc" }, select: { number: true, percent: true, passed: true, submittedAt: true, startedAt: true, correct: true, total: true } },
      },
    }),
    qualificationsOf(userId),
    hoursOf(userId, who.orgId),
    sessionsOf(userId),
    activePlacedStaff(who.orgId, { kind: "some", userIds: new Set([userId]) }),
    organisationChart(),
  ]);
  const versionIds = [...new Set(assignments.map((a) => a.versionId).filter((v): v is string => !!v))];
  const versions = new Map((versionIds.length ? await prisma.trainingCourseVersion.findMany({ where: { id: { in: versionIds } }, select: { id: true, number: true, publishedAt: true, outline: true } }) : [])
    .map((v) => [v.id, { number: v.number, publishedAt: v.publishedAt, lessons: new Map(readOutline(v.outline).sections.flatMap((s) => s.lessons.map((l) => [l.id, l.title] as const))) }]));
  const [trail, qualificationTrail] = await Promise.all([
    auditTrailFor("TrainingAssignment", assignments.map((a) => a.id)),
    auditTrailFor("Qualification", qualifications.map((q) => q.id)),
  ]);
  const sites = new Map(chart.sites.map((s) => [s.id, s.name]));
  const on = today();
  const titleOf = new Map(assignments.map((a) => [a.id, a.course.title]));
  return {
    who, generatedAt: new Date(),
    person: { ...person, sites: placed[0] ? sitesInWords(placed[0], sites) : "" },
    courses: assignments.map((a) => {
      const version = a.versionId ? versions.get(a.versionId) : undefined;
      return {
        id: a.id, title: a.course.title, state: trainingState(a, on), assignedAt: a.assignedAt, assignedByName: a.assignedByName, dueOn: a.dueOn,
        submittedAt: a.submittedAt, completedAt: a.completedAt, cancelledAt: a.cancelledAt, cancelReason: a.cancelReason,
        version: version ? { number: version.number, publishedAt: version.publishedAt } : null,
        lessons: [...a.progress].sort((x, y) => x.completedAt.getTime() - y.completedAt.getTime()).map((p) => ({ title: version?.lessons.get(p.lessonId) ?? "A lesson since removed", at: p.completedAt })),
        attempts: a.examAttempts, signedOffByName: a.signedOffByName, signoffNote: a.signoffNote, observation: readObservationRecord(a.observation),
        evidence: a.evidence, certificateCode: a.status === "COMPLETED" ? a.certificateCode : null,
      };
    }),
    qualifications: qualifications.map((q) => ({ ...q, state: qualificationState(q, on) })),
    hours, sessions,
    trail: [...trail.map((t) => ({ ...t, about: titleOf.get(t.entityId ?? "") ?? "Training" })), ...qualificationTrail.map((t) => ({ ...t, about: "Qualification" }))]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  };
}
export type PersonAuditPack = Awaited<ReturnType<typeof personAuditPack>>;

/** A course's audit pack: its versions and what changed in each, who must take it, and every
 *  person the reader covers who was given it, with the version they were taught, their result and
 *  sign-off, plus the audit trail of the course and of that training. */
export async function courseAuditPack(courseId: string, filters: InsightFilters = {}) {
  const who = await requireTrainingActor();
  const course = await prisma.trainingCourse.findFirst({
    where: { id: courseId, orgId: who.orgId ?? undefined },
    select: {
      id: true, title: true, summary: true, requiresSignoff: true, archivedAt: true, createdAt: true,
      versions: { orderBy: { number: "asc" }, select: { id: true, number: true, publishedAt: true, publishedByName: true, lessonCount: true, changeNote: true, retake: true } },
      rule: { select: { roleIds: true, departmentIds: true, siteIds: true, positionIds: true, dueDays: true, renewMonths: true, renewLeadDays: true, pausedAt: true } },
    },
  });
  if (!course) notFound();
  const [people, chart, positions] = await Promise.all([coveredPeople(who, filters), organisationChart(), livePositionsOf(who.orgId)]);
  const byId = new Map(people.map((p) => [p.id, p]));
  const rows = await assignmentsWhere({ courseId, userId: { in: [...byId.keys()] }, ...(since(filters.period) ? { assignedAt: { gte: since(filters.period)! } } : {}) });
  const map = (list: { id: string; name: string }[]) => new Map(list.map((x) => [x.id, x.name]));
  const sites = map(chart.sites);
  const [courseTrail, trail] = await Promise.all([auditTrailFor("TrainingCourse", [courseId], 300), auditTrailFor("TrainingAssignment", rows.map((r) => r.id))]);
  const nameOf = new Map(rows.map((r) => [r.id, byId.get(r.userId)?.name ?? "Former staff"]));
  const versionNumber = new Map(course.versions.map((v) => [v.id, v.number]));
  const on = today();
  return {
    who, generatedAt: new Date(), filters,
    course: { id: course.id, title: course.title, summary: course.summary, requiresSignoff: course.requiresSignoff, archived: !!course.archivedAt, createdAt: course.createdAt },
    versions: course.versions,
    rule: course.rule ? {
      audience: audienceInWords(course.rule, { roles: map(chart.roles), departments: map(chart.departments), sites, positions: map(positions) }),
      timing: timingInWords(course.rule), paused: !!course.rule.pausedAt,
    } : null,
    learners: [...rows].sort((a, b) => (nameOf.get(a.id) ?? "").localeCompare(nameOf.get(b.id) ?? "") || a.assignedAt.getTime() - b.assignedAt.getTime()).map((r) => ({
      id: r.id, name: nameOf.get(r.id)!, sites: sitesInWords(byId.get(r.userId), sites), state: trainingState(r, on),
      version: r.versionId ? versionNumber.get(r.versionId) ?? null : null, assignedAt: r.assignedAt, dueOn: r.dueOn, completedAt: r.completedAt,
      best: bestScore(r.facts), attempts: r.examAttempts.length, signedOffByName: r.signedOffByName, certificateCode: r.status === "COMPLETED" ? r.certificateCode : null,
    })),
    trail: [...courseTrail.map((t) => ({ ...t, about: "The course" })), ...trail.map((t) => ({ ...t, about: nameOf.get(t.entityId ?? "") ?? "Training" }))]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  };
}
export type CourseAuditPack = Awaited<ReturnType<typeof courseAuditPack>>;

/** Rows for the downloads, in the order the pages show them. */
export function learnerCsv(data: CourseInsight) {
  return [
    ["Person", "Sites", "Where they are", "Version", "Given", "Due", "Last activity", "Exam sittings", "Best score", "Completed", "Days to finish", "Signed off by", "Certificate"],
    ...data.learners.map((l) => [l.name, l.sites, l.stage, l.version ?? "", iso(l.assignedAt), iso(l.dueOn), iso(l.lastActivity), l.attempts || "", l.best === null ? "" : `${l.best}%`,
      iso(l.completedAt), l.days ?? "", l.signedOffByName ?? "", l.certificateCode ?? ""]),
  ];
}
export function overdueCsv(data: TrainingReport) {
  return [
    ["Person", "Course", "Due", "Days overdue", "Where they are", "Sites", "Manager"],
    ...data.overdue.map((o) => [o.name, o.course.title, iso(o.dueOn), o.daysLate, o.stage.replace(", overdue", ""), o.sites, o.manager ?? "No manager set"]),
  ];
}
export function coursesCsv(data: TrainingReport) {
  return [
    ["Course", "Given", "Completed", "Completed %", "Overdue", "Passed exam first time %", "Days to finish (middle)", "Rating", "Ratings"],
    ...data.courses.map((c) => [c.title, c.assigned, c.completed, c.completion ?? "", c.overdue, c.firstTime ?? "", c.daysToFinish ?? "", c.rating?.average ?? "", c.rating?.count ?? 0]),
  ];
}
