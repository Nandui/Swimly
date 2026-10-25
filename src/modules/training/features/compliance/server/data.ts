import "server-only";
import { activePlacedStaff, livePositionsOf, organisationChart, type PlacedStaff } from "@/lib/directory";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { qualificationTypesByIds } from "@/lib/qualifications";
import { sitesFor, subjectsFor } from "@/lib/policy/session";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { audienceInWords, isCompliant, matrixCell, ruleCovers, timingInWords, type MatrixCell } from "@/modules/training/shared/rules";

/** Reads for the training rules and the training matrix (e-learning
 *  phase 4). The matrix shows only the people the reader's
 *  `training.records.read` covers. */

const RULE_SELECT = {
  id: true, courseId: true, roleIds: true, departmentIds: true, siteIds: true, positionIds: true, dueDays: true, renewMonths: true, renewLeadDays: true,
  pausedAt: true, lastRunAt: true, createdByName: true, course: { select: { title: true, publishedVersionId: true, content: true, grantsTypeId: true } },
} as const;

async function names(orgId: string | null) {
  const [chart, positions] = await Promise.all([organisationChart(), livePositionsOf(orgId)]);
  const map = (list: { id: string; name: string }[]) => new Map(list.map((x) => [x.id, x.name]));
  return { chart: { ...chart, positions }, maps: { roles: map(chart.roles), departments: map(chart.departments), sites: map(chart.sites), positions: map(positions) } };
}

async function histories(courseIds: string[], userIds: string[]) {
  const rows = courseIds.length && userIds.length ? await prisma.trainingAssignment.findMany({
    where: { courseId: { in: courseIds }, userId: { in: userIds } },
    select: { courseId: true, userId: true, status: true, assignedAt: true, completedAt: true, cancelledAt: true, ruleId: true, dueOn: true },
  }) : [];
  const by = new Map<string, typeof rows>();
  for (const row of rows) { const key = `${row.courseId}:${row.userId}`; by.set(key, [...(by.get(key) ?? []), row]); }
  return (courseId: string, userId: string) => by.get(`${courseId}:${userId}`) ?? [];
}

/** The rules page: every rule in words with how many it covers and how many are in date, the courses
 *  without one, and what a rule can be aimed at. */
export async function trainingRules() {
  const who = await requireTrainingActor();
  const canManage = who.assign && (await sitesFor("training.assign")).kind === "all";
  const [rules, courses, { chart, maps }, people] = await Promise.all([
    prisma.trainingRule.findMany({ where: { orgId: who.orgId ?? undefined, course: { archivedAt: null } }, select: RULE_SELECT, orderBy: { course: { title: "asc" } } }),
    prisma.trainingCourse.findMany({ where: { orgId: who.orgId ?? undefined, archivedAt: null }, select: { id: true, title: true, rule: { select: { id: true } } }, orderBy: { title: "asc" } }),
    names(who.orgId),
    activePlacedStaff(who.orgId),
  ]);
  const on = parseDateOnly(today());
  const [history, types] = await Promise.all([histories(rules.map((r) => r.courseId), people.map((p) => p.id)), qualificationTypesByIds(rules.map((r) => r.course.grantsTypeId))]);
  return {
    who, canManage, options: chart,
    coursesWithout: courses.filter((c) => !c.rule).map((c) => ({ id: c.id, title: c.title })),
    rules: rules.map((rule) => {
      const covered = people.filter((p) => ruleCovers(rule, p));
      const cells = covered.map((p) => matrixCell(rule, history(rule.courseId, p.id), on));
      return {
        id: rule.id, courseId: rule.courseId, title: rule.course.title, grants: rule.course.grantsTypeId ? types.get(rule.course.grantsTypeId)?.name ?? null : null,
        audience: audienceInWords(rule, maps), timing: timingInWords(rule), paused: !!rule.pausedAt, lastRunAt: rule.lastRunAt,
        waiting: !rule.course.publishedVersionId && !rule.course.content.trim(),
        input: { roleIds: rule.roleIds, departmentIds: rule.departmentIds, siteIds: rule.siteIds, positionIds: rule.positionIds, dueDays: rule.dueDays, renewMonths: rule.renewMonths, renewLeadDays: rule.renewLeadDays },
        covered: covered.length, compliant: cells.filter(isCompliant).length, overdue: cells.filter((c) => c.kind === "due" && c.overdue || c.kind === "expired").length,
      };
    }),
  };
}

export type MatrixFilters = { site?: string; department?: string; course?: string };

/** The training matrix: the people the reader covers down the side, every course a rule requires
 *  across the top, and where each person stands. Filtered by site, department or one course. */
export async function trainingMatrix(filters: MatrixFilters = {}) {
  const who = await requireTrainingActor();
  const scope = await subjectsFor("training.records.read");
  const [rules, { chart }, everyone] = await Promise.all([
    prisma.trainingRule.findMany({ where: { orgId: who.orgId ?? undefined, course: { archivedAt: null }, ...(filters.course ? { courseId: filters.course } : {}) }, select: RULE_SELECT, orderBy: { course: { title: "asc" } } }),
    names(who.orgId),
    activePlacedStaff(who.orgId, scope),
  ]);
  const people = everyone.filter((p) => (!filters.site || !p.siteIds.length || p.siteIds.includes(filters.site)) && (!filters.department || p.departmentIds.includes(filters.department)));
  const on = parseDateOnly(today());
  const history = await histories(rules.map((r) => r.courseId), people.map((p) => p.id));
  const courses = rules.map((r) => ({ id: r.courseId, title: r.course.title, paused: !!r.pausedAt }));
  const rows = people.map((person: PlacedStaff) => {
    const cells: (MatrixCell | null)[] = rules.map((rule) => ruleCovers(rule, person) ? matrixCell(rule, history(rule.courseId, person.id), on) : null);
    const needed = cells.filter((c): c is MatrixCell => !!c);
    return { id: person.id, name: person.name, cells, needed: needed.length, compliant: needed.filter(isCompliant).length };
  }).filter((row) => row.needed > 0);
  const columns = courses.map((course, i) => {
    const cells = rows.map((r) => r.cells[i]).filter((c): c is MatrixCell => !!c);
    return { ...course, needed: cells.length, compliant: cells.filter(isCompliant).length };
  });
  const needed = rows.reduce((n, r) => n + r.needed, 0), compliant = rows.reduce((n, r) => n + r.compliant, 0);
  return {
    who, columns, rows, sites: chart.sites, departments: chart.departments, allCourses: (await prisma.trainingRule.findMany({ where: { orgId: who.orgId ?? undefined, course: { archivedAt: null } }, select: { courseId: true, course: { select: { title: true } } }, orderBy: { course: { title: "asc" } } })).map((r) => ({ id: r.courseId, title: r.course.title })),
    summary: { needed, compliant, percent: needed ? Math.floor((compliant / needed) * 100) : 100 },
  };
}
