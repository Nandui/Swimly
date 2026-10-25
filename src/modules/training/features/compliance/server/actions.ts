"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { livePositionsOf, organisationChart } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { sitesFor } from "@/lib/policy/session";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { MAX_RULE_LIST, timingInWords } from "@/modules/training/shared/rules";
import { refresh } from "@/modules/training/shared/writes";
import { applyTrainingRules } from "@/modules/training/features/compliance/server/engine";

/** Training rules (e-learning phase 4): who must take a
 *  course and how often. A rule assigns the course to everyone it covers, so
 *  managing rules needs Assign training for everyone (the Manage level). Every
 *  change is audited; saving a rule runs it straight away. */

const NO_RIGHT = "Training rules need the Manage level in Training for every site, because they assign courses to everyone they cover.";

async function manager() {
  const who = await requireTrainingActor();
  if (!who.assign || !who.orgId) return null;
  return (await sitesFor("training.assign")).kind === "all" ? who as typeof who & { orgId: string } : null;
}

const ids = z.array(z.string().min(1).max(64)).max(MAX_RULE_LIST).default([]);
const ruleSchema = z.object({
  roleIds: ids, departmentIds: ids, siteIds: ids, positionIds: ids,
  dueDays: z.number().int().min(1, "Give people at least a day.").max(365, "Allow up to a year to finish."),
  renewMonths: z.number().int().min(1, "Repeat it every month at most often.").max(120, "Repeat it at least every 10 years.").nullable(),
  renewLeadDays: z.number().int().min(0).max(180, "Assign it again up to 180 days before it is due.").default(30),
});
export type RuleInput = z.input<typeof ruleSchema>;

export type RuleSaved = { ok: true; assigned: number } | Extract<ActionResult, { ok: false }>;

/** Creates or changes the course's rule, then runs it. Returns how many people it assigned. */
export async function saveTrainingRule(courseId: string, input: RuleInput): Promise<RuleSaved> {
  const who = await manager();
  if (!who) return fail(NO_RIGHT);
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const rule = { ...parsed.data, roleIds: [...new Set(parsed.data.roleIds)], departmentIds: [...new Set(parsed.data.departmentIds)], siteIds: [...new Set(parsed.data.siteIds)], positionIds: [...new Set(parsed.data.positionIds)] };
  const [chart, positions] = await Promise.all([organisationChart(), livePositionsOf(who.orgId)]);
  const known = (list: string[], from: { id: string }[]) => list.every((id) => from.some((x) => x.id === id));
  if (!known(rule.roleIds, chart.roles) || !known(rule.departmentIds, chart.departments) || !known(rule.siteIds, chart.sites) || !known(rule.positionIds, positions)) {
    return fail("Something you chose has been removed. Reload and choose again.");
  }
  const result = await prisma.$transaction(async (tx) => {
    const course = await tx.trainingCourse.findFirst({ where: { id: courseId, orgId: who.orgId }, select: { title: true, archivedAt: true, rule: { select: { id: true } } } });
    if (!course) return fail("That course no longer exists.");
    if (course.archivedAt) return fail("Restore this course before giving it a rule.");
    const saved = await tx.trainingRule.upsert({
      where: { courseId },
      create: { orgId: who.orgId, courseId, ...rule, createdById: who.id, createdByName: who.name },
      update: rule,
      select: { id: true },
    });
    await logAudit({ actorId: who.id, actorName: who.name, action: course.rule ? "update" : "create", entity: "TrainingRule", entityId: saved.id,
      summary: `${course.rule ? "Changed" : "Added"} the training rule for ${course.title}: ${timingInWords(rule)}` }, tx);
    return ok();
  });
  if (!result.ok) return result;
  const run = await applyTrainingRules({ orgId: who.orgId, ruleId: (await prisma.trainingRule.findUniqueOrThrow({ where: { courseId }, select: { id: true } })).id });
  refresh("/training/rules", "/training/matrix", `/training/courses/${courseId}`);
  return { ok: true, assigned: run.assigned };
}

/** Pauses a rule (nobody new is assigned; what was assigned stays) or starts it again. */
export async function setTrainingRulePaused(ruleId: string, paused: boolean): Promise<RuleSaved> {
  const who = await manager();
  if (!who) return fail(NO_RIGHT);
  const result = await prisma.$transaction(async (tx) => {
    const rule = await tx.trainingRule.findFirst({ where: { id: ruleId, orgId: who.orgId }, select: { pausedAt: true, course: { select: { title: true } } } });
    if (!rule) return fail("That rule no longer exists.");
    if (!!rule.pausedAt === paused) return ok();
    await tx.trainingRule.update({ where: { id: ruleId }, data: { pausedAt: paused ? new Date() : null } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "TrainingRule", entityId: ruleId, summary: `${paused ? "Paused" : "Restarted"} the training rule for ${rule.course.title}` }, tx);
    return ok();
  });
  if (!result.ok) return result;
  const run = paused ? { assigned: 0 } : await applyTrainingRules({ orgId: who.orgId, ruleId });
  refresh("/training/rules", "/training/matrix");
  return { ok: true, assigned: run.assigned };
}

/** Takes the rule off the course. Training it assigned stays assigned. */
export async function removeTrainingRule(ruleId: string): Promise<ActionResult> {
  const who = await manager();
  if (!who) return fail(NO_RIGHT);
  const result = await prisma.$transaction(async (tx) => {
    const rule = await tx.trainingRule.findFirst({ where: { id: ruleId, orgId: who.orgId }, select: { courseId: true, course: { select: { title: true } } } });
    if (!rule) return fail("That rule no longer exists.");
    await tx.trainingRule.delete({ where: { id: ruleId } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "delete", entity: "TrainingRule", entityId: ruleId, summary: `Took the training rule off ${rule.course.title}; training it assigned stays assigned` }, tx);
    return ok();
  });
  if (result.ok) refresh("/training/rules", "/training/matrix");
  return result;
}

/** Runs every rule now instead of waiting for tonight. */
export async function runTrainingRulesNow(): Promise<RuleSaved> {
  const who = await manager();
  if (!who) return fail(NO_RIGHT);
  const run = await applyTrainingRules({ orgId: who.orgId });
  if (run.assigned) await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "TrainingRule", entityId: null, summary: `Ran the training rules: ${run.assigned} assigned` });
  refresh("/training/rules", "/training/matrix");
  return { ok: true, assigned: run.assigned };
}
