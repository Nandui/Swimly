"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { isDateOnly, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireTasksActor } from "@/modules/tasks/shared/access";
import { asDefinition, siteSettings } from "@/modules/tasks/shared/data";
import { dayIn } from "@/modules/tasks/shared/rules";
import { allowedAt, loadTask, makeTaskNow, refresh } from "@/modules/tasks/shared/writes";

// ---------------------------------------------------------------------------
// Follow-up actions
// ---------------------------------------------------------------------------

const actionSchema = z.object({
  title: z.string().trim().min(3, "Say what needs to happen.").max(300),
  dueOn: z.string().refine((v) => v === "" || isDateOnly(v), "Give the date as a date.").default(""),
});

/** Raise a follow-up action, from a task or on its own at a site. From a follow-up action
 *  template, it also makes that template's task at the site today, to record the work. */
export async function raiseTaskAction(input: { siteId: string; taskId?: string | null; title: string; dueOn?: string; templateId?: string | null }): Promise<ActionResult> {
  const who = await requireTasksActor();
  const template = input.templateId
    ? await prisma.taskTemplate.findFirst({ where: { id: input.templateId, orgId: who.orgId ?? undefined, status: "published", kind: "action" } })
    : null;
  if (input.templateId && !template) return fail("That follow-up is no longer available.");
  const parsed = actionSchema.safeParse({ ...input, title: input.title.trim() || template?.title || "" });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  let siteId = input.siteId, from = "";
  if (input.taskId) {
    const task = await loadTask(input.taskId, who.orgId);
    if (!task) return fail("That task no longer exists.");
    siteId = task.siteId;
    from = ` from ${asDefinition(task.definition).title}`;
  }
  if (!(await allowedAt("tasks.complete", siteId, who))) return fail("Your role does not do tasks at that site.");
  const site = await prisma.club.findUnique({ where: { id: siteId }, select: { name: true } });
  if (!site) return fail("That site no longer exists.");
  if (template && template.siteIds.length && !template.siteIds.includes(siteId)) return fail("That follow-up is not available at this site.");
  const settings = (await siteSettings([siteId])).get(siteId)!;
  await prisma.$transaction(async (tx) => {
    const followUp = template ? await makeTaskNow(tx, who, template, siteId, dayIn(settings.timezone), settings) : null;
    const a = await tx.taskAction.create({
      data: { orgId: who.orgId ?? "", siteId, taskId: input.taskId || null, title: parsed.data.title, dueOn: parsed.data.dueOn ? parseDateOnly(parsed.data.dueOn) : null,
        raisedById: who.id, raisedByName: who.name, followUpTaskId: followUp?.id ?? null },
      select: { id: true },
    });
    await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "TaskAction", entityId: a.id, clubId: siteId, summary: `Raised a follow-up at ${site.name}${from}: ${parsed.data.title}` }, tx);
  });
  refresh(input.taskId ?? undefined);
  return ok();
}

/** Resolve a follow-up with what was done, or open it again. */
export async function setTaskActionResolved(id: string, resolved: boolean, note: string): Promise<ActionResult> {
  const who = await requireTasksActor();
  const text = note.trim();
  if (resolved && (text.length < 3 || text.length > 1000)) return fail("Say what was done, so the record shows how it was put right.");
  const action = await prisma.taskAction.findFirst({ where: { id, orgId: who.orgId ?? undefined }, select: { siteId: true, taskId: true, title: true, status: true, site: { select: { name: true } } } });
  if (!action || !(await allowedAt("tasks.complete", action.siteId, who))) return fail("That action no longer exists.");
  if (!(await allowedAt("tasks.review", action.siteId, who))) return fail("Resolving actions needs Tasks: Review at this site.");
  const from = resolved ? "open" : "resolved";
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.taskAction.updateMany({
      where: { id, status: from },
      data: resolved ? { status: "resolved", resolvedAt: new Date(), resolvedByName: who.name, resolution: text } : { status: "open", resolvedAt: null, resolvedByName: null, resolution: "" },
    });
    if (moved.count !== 1) return fail(resolved ? "It is already resolved." : "It is already open.");
    await logAudit({ actorId: who.id, actorName: who.name, action: resolved ? "resolve" : "reopen", entity: "TaskAction", entityId: id, clubId: action.siteId,
      summary: `${resolved ? "Resolved" : "Reopened"} the follow-up at ${action.site.name}: ${action.title}` }, tx);
    return ok();
  });
  if (result.ok) refresh(action.taskId ?? undefined);
  return result;
}
