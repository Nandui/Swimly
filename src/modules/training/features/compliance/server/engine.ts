import "server-only";
import { logAudit } from "@/lib/audit";
import { activePlacedStaff } from "@/lib/directory";
import { parseDateOnly, today, toDateOnlyString } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ruleCovers, ruleState } from "@/modules/training/shared/rules";

/** The compliance autopilot's run (e-learning phase 4).
 *  For every live rule, everyone it covers who has nothing open on the course
 *  and either never finished it or is due again is assigned it, by the rule.
 *  Runs daily from the cron and straight after a rule is saved. Each
 *  assignment is audited in its own transaction with a lock on the course, so
 *  two runs at once never assign twice. */

export const AUTOPILOT_NAME = "Turnfin (training rule)";

export type RunResult = { rules: number; assigned: number; renewals: number };

export async function applyTrainingRules(opts: { orgId?: string | null; ruleId?: string; now?: Date } = {}): Promise<RunResult> {
  const on = parseDateOnly(today(opts.now));
  const rules = await prisma.trainingRule.findMany({
    where: { pausedAt: null, ...(opts.orgId ? { orgId: opts.orgId } : {}), ...(opts.ruleId ? { id: opts.ruleId } : {}), course: { archivedAt: null } },
    select: { id: true, orgId: true, courseId: true, roleIds: true, departmentIds: true, siteIds: true, positionIds: true, dueDays: true, renewMonths: true, renewLeadDays: true,
      course: { select: { title: true, publishedVersionId: true, content: true } } },
  });
  const staffByOrg = new Map<string, Awaited<ReturnType<typeof activePlacedStaff>>>();
  const result: RunResult = { rules: rules.length, assigned: 0, renewals: 0 };
  for (const rule of rules) {
    // A course with nothing to take yet waits until it is published.
    if (!rule.course.publishedVersionId && !rule.course.content.trim()) continue;
    if (!staffByOrg.has(rule.orgId)) staffByOrg.set(rule.orgId, await activePlacedStaff(rule.orgId));
    const covered = staffByOrg.get(rule.orgId)!.filter((p) => ruleCovers(rule, p));
    if (!covered.length) { await prisma.trainingRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } }); continue; }
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "TrainingCourse" WHERE id = ${rule.courseId} FOR UPDATE`;
      const history = await tx.trainingAssignment.findMany({
        where: { courseId: rule.courseId, userId: { in: covered.map((p) => p.id) } },
        select: { userId: true, status: true, assignedAt: true, completedAt: true, cancelledAt: true, ruleId: true },
      });
      for (const person of covered) {
        const state = ruleState(rule, history.filter((h) => h.userId === person.id), on);
        if (state.state !== "assign") continue;
        const row = await tx.trainingAssignment.create({ data: {
          orgId: rule.orgId, courseId: rule.courseId, userId: person.id, dueOn: state.dueOn, assignedById: null, assignedByName: AUTOPILOT_NAME,
          ruleId: rule.id,
        } });
        await logAudit({ actorId: null, actorName: AUTOPILOT_NAME, action: "assign", entity: "TrainingAssignment", entityId: row.id,
          summary: `Assigned ${rule.course.title} to ${person.name} by its training rule${state.renewal ? " (due again)" : ""}, due ${toDateOnlyString(state.dueOn)}` }, tx);
        result.assigned++;
        if (state.renewal) result.renewals++;
      }
      await tx.trainingRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } });
    });
  }
  return result;
}
