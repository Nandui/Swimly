"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { siteName, staffRoleIdOf } from "@/lib/directory";
import { isDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { mayFor } from "@/lib/policy/session";
import { requireTasksActor, type TasksActor } from "@/modules/tasks/shared/access";
import { asDefinition, isMine, siteSettings } from "@/modules/tasks/shared/data";
import { completionProblems, dayIn, exceptions, type TaskRecord } from "@/modules/tasks/shared/rules";
import { allowedAt, json, loadTask, makeTaskNow, refresh } from "@/modules/tasks/shared/writes";

/** Tasks' writes (docs/tasks.md). Doing a task needs `tasks.complete` at its
 *  site and, when it is aimed at roles, one of them (reviewers may always step
 *  in); approving, reopening, not applicable and resolving actions need
 *  `tasks.review` there, and nobody approves their own; templates need
 *  `tasks.manage`. Every change checks the version it was made from and is
 *  audited in the same transaction. */

const STALE = "Someone else changed this task. Reload the page to see their changes, then try again.";

type Loaded = { ok: true; who: TasksActor; task: NonNullable<Awaited<ReturnType<typeof loadTask>>> } | { ok: false; error: string };

/** A task this person may work on: open, at a site they do tasks at, and theirs to do. */
async function workable(id: string): Promise<Loaded> {
  const who = await requireTasksActor();
  const task = await loadTask(id, who.orgId);
  if (!task || !(await allowedAt("tasks.complete", task.siteId, who))) return { ok: false, error: "That task no longer exists." };
  const reviewer = await mayFor("tasks.review", { siteId: task.siteId, orgId: who.orgId });
  if (!isMine(asDefinition(task.definition), await roleIdOf(who.id), reviewer)) return { ok: false, error: "This task is for other roles. Ask someone it is aimed at, or whoever reviews tasks here." };
  return { ok: true, who, task };
}

/** A task this person reviews: at a site where they hold `tasks.review`. */
async function reviewable(id: string): Promise<Loaded> {
  const who = await requireTasksActor();
  const task = await loadTask(id, who.orgId);
  if (!task || !(await allowedAt("tasks.complete", task.siteId, who))) return { ok: false, error: "That task no longer exists." };
  if (!(await allowedAt("tasks.review", task.siteId, who))) return { ok: false, error: "Reviewing tasks here needs Tasks: Review at this site." };
  return { ok: true, who, task };
}

const roleIdOf = (userId: string) => staffRoleIdOf(userId);

// ---------------------------------------------------------------------------
// Doing a task
// ---------------------------------------------------------------------------

const answersSchema = z.object({
  checks: z.array(z.boolean()).max(100),
  records: z.array(z.record(z.string().max(64), z.string().max(4000))).min(1, "Keep at least one record.").max(50, "Keep it to 50 records."),
});
export type TaskAnswers = z.input<typeof answersSchema>;

/** Only the answers the task asks for, and only files that belong to it. */
async function cleanAnswers(taskId: string, def: ReturnType<typeof asDefinition>, input: TaskAnswers) {
  const parsed = answersSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const asked = def.fields.filter((f) => f.type !== "heading");
  const fileIds = new Set((await prisma.taskFile.findMany({ where: { taskId }, select: { id: true } })).map((f) => f.id));
  const records: TaskRecord[] = parsed.data.records.map((row) => Object.fromEntries(asked.flatMap((f) => {
    const v = (row[f.id] ?? "").trim();
    if (!v) return [];
    if (f.type === "file" && !fileIds.has(v)) return [];
    return [[f.id, v]];
  })));
  const checks = def.checklist.map((_, i) => parsed.data.checks[i] === true);
  return { ok: true as const, checks, records };
}

/** Save what is ticked and answered so far, without completing it. */
export async function saveTaskProgress(id: string, version: number, input: TaskAnswers): Promise<ActionResult> {
  const loaded = await workable(id);
  if (!loaded.ok) return fail(loaded.error);
  const { who, task } = loaded;
  if (task.status !== "open") return fail("This task is closed. Reopen it to change it.");
  const def = asDefinition(task.definition);
  const answers = await cleanAnswers(id, def, input);
  if (!answers.ok) return fail(answers.error);
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.task.updateMany({ where: { id, version, status: "open" }, data: { checks: answers.checks, records: json(answers.records), version: { increment: 1 } } });
    if (moved.count !== 1) return fail(STALE);
    await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "Task", entityId: id, clubId: task.siteId, summary: `Saved progress on ${def.title} at ${task.site.name}` }, tx);
    return ok();
  });
  if (result.ok) refresh(id);
  return result;
}

/** Complete a task: every checklist item ticked, every required answer given, a comment if
 *  it asks for one, and a follow-up action for a reading that must be followed up. */
export async function completeTask(id: string, version: number, input: TaskAnswers): Promise<ActionResult> {
  const loaded = await workable(id);
  if (!loaded.ok) return fail(loaded.error);
  const { who, task } = loaded;
  if (task.status !== "open") return fail("This task is already closed.");
  const def = asDefinition(task.definition);
  const answers = await cleanAnswers(id, def, input);
  if (!answers.ok) return fail(answers.error);
  const [comments, actions] = await Promise.all([prisma.taskComment.count({ where: { taskId: id } }), prisma.taskAction.count({ where: { taskId: id } })]);
  const problems = completionProblems(def, answers.checks, answers.records, comments > 0, actions > 0);
  if (problems.length) return fail(problems.join(" "));
  const found = exceptions(def, answers.records);
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.task.updateMany({
      where: { id, version, status: "open" },
      data: { status: "done", checks: answers.checks, records: json(answers.records), exceptions: found, completedAt: new Date(), completedById: who.id, completedByName: who.name, version: { increment: 1 } },
    });
    if (moved.count !== 1) return fail(STALE);
    await logAudit({ actorId: who.id, actorName: who.name, action: "complete", entity: "Task", entityId: id, clubId: task.siteId,
      summary: `Completed ${def.title} at ${task.site.name}${found.length ? ` with ${found.length} ${found.length === 1 ? "reading" : "readings"} out of range` : ""}` }, tx);
    return ok();
  });
  if (result.ok) refresh(id);
  return result;
}

/** Say why a task cannot be done today. It counts as not done in the score. */
export async function cantCompleteTask(id: string, version: number, reason: string): Promise<ActionResult> {
  const text = reason.trim();
  if (text.length < 3 || text.length > 1000) return fail("Say briefly why it can’t be done, so whoever reviews it knows.");
  const loaded = await workable(id);
  if (!loaded.ok) return fail(loaded.error);
  return close(loaded, version, "cant_complete", text, `Could not complete`);
}

/** Not applicable today (the pool is closed, say). Left out of the score, so it needs a reviewer. */
export async function notApplicableTask(id: string, version: number, reason: string): Promise<ActionResult> {
  const text = reason.trim();
  if (text.length < 3 || text.length > 1000) return fail("Say briefly why it does not apply.");
  const loaded = await reviewable(id);
  if (!loaded.ok) return fail(loaded.error);
  return close(loaded, version, "not_applicable", text, "Marked not applicable");
}

async function close(loaded: Extract<Loaded, { ok: true }>, version: number, status: "cant_complete" | "not_applicable", reason: string, verb: string): Promise<ActionResult> {
  const { who, task } = loaded;
  if (task.status !== "open") return fail("This task is already closed.");
  const def = asDefinition(task.definition);
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.task.updateMany({ where: { id: task.id, version, status: "open" }, data: { status, reason, completedAt: new Date(), completedById: who.id, completedByName: who.name, version: { increment: 1 } } });
    if (moved.count !== 1) return fail(STALE);
    await logAudit({ actorId: who.id, actorName: who.name, action: status === "not_applicable" ? "not-applicable" : "cant-complete", entity: "Task", entityId: task.id, clubId: task.siteId, summary: `${verb}: ${def.title} at ${task.site.name}` }, tx);
    return ok();
  });
  if (result.ok) refresh(task.id);
  return result;
}

/** Approve a completed task that asks for approval. Never your own. */
export async function approveTask(id: string, version: number): Promise<ActionResult> {
  const loaded = await reviewable(id);
  if (!loaded.ok) return fail(loaded.error);
  const { who, task } = loaded;
  const def = asDefinition(task.definition);
  if (task.status !== "done" || !def.requiresApproval) return fail("Only a completed task that asks for approval can be approved.");
  if (task.approvedAt) return fail("It is already approved.");
  if (task.completedById === who.id) return fail("Someone else has to approve a task you completed.");
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.task.updateMany({ where: { id, version, status: "done", approvedAt: null }, data: { approvedAt: new Date(), approvedById: who.id, approvedByName: who.name, version: { increment: 1 } } });
    if (moved.count !== 1) return fail(STALE);
    await logAudit({ actorId: who.id, actorName: who.name, action: "approve", entity: "Task", entityId: id, clubId: task.siteId, summary: `Approved ${def.title} at ${task.site.name}` }, tx);
    return ok();
  });
  if (result.ok) refresh(id);
  return result;
}

/** Open a closed task again, keeping its answers; its completion and approval are cleared. */
export async function reopenTask(id: string, version: number): Promise<ActionResult> {
  const loaded = await reviewable(id);
  if (!loaded.ok) return fail(loaded.error);
  const { who, task } = loaded;
  if (task.status === "open") return fail("It is already open.");
  const def = asDefinition(task.definition);
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.task.updateMany({
      where: { id, version },
      data: { status: "open", reason: "", exceptions: [], completedAt: null, completedById: null, completedByName: null, approvedAt: null, approvedById: null, approvedByName: null, version: { increment: 1 } },
    });
    if (moved.count !== 1) return fail(STALE);
    await logAudit({ actorId: who.id, actorName: who.name, action: "reopen", entity: "Task", entityId: id, clubId: task.siteId, summary: `Reopened ${def.title} at ${task.site.name}` }, tx);
    return ok();
  });
  if (result.ok) refresh(id);
  return result;
}

export async function addTaskComment(id: string, text: string): Promise<ActionResult> {
  const body = text.trim();
  if (body.length < 2 || body.length > 2000) return fail("Write the comment (up to 2,000 characters).");
  const who = await requireTasksActor();
  const task = await loadTask(id, who.orgId);
  if (!task || !(await allowedAt("tasks.complete", task.siteId, who))) return fail("That task no longer exists.");
  await prisma.$transaction(async (tx) => {
    const c = await tx.taskComment.create({ data: { taskId: id, text: body, byId: who.id, byName: who.name }, select: { id: true } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "comment", entity: "Task", entityId: id, clubId: task.siteId,
      summary: `Commented on ${asDefinition(task.definition).title} at ${task.site.name}`, details: { commentId: c.id } }, tx);
  });
  refresh(id);
  return ok();
}

/** A photo or file answer: PNG, JPEG or PDF up to 5 MB, checked by its first bytes. */
const FILE_TYPES = { "application/pdf": [0x25, 0x50, 0x44, 0x46], "image/png": [0x89, 0x50, 0x4e, 0x47], "image/jpeg": [0xff, 0xd8, 0xff] } as const;
const FILE_MAX = 5 * 1024 * 1024;

export async function uploadTaskFile(id: string, form: FormData): Promise<ActionResult & { fileId?: string; fileName?: string }> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a photo or file.");
  if (file.size > FILE_MAX) return fail("The file must be 5 MB or smaller.");
  const loaded = await workable(id);
  if (!loaded.ok) return fail(loaded.error);
  const { who, task } = loaded;
  if (task.status !== "open") return fail("This task is closed. Reopen it to change it.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = (Object.keys(FILE_TYPES) as (keyof typeof FILE_TYPES)[]).find((m) => FILE_TYPES[m].every((b, i) => bytes[i] === b));
  if (!mime) return fail("Attach a photo (PNG or JPEG) or a PDF.");
  const fileName = file.name.slice(0, 120) || "file";
  const saved = await prisma.$transaction(async (tx) => {
    const row = await tx.taskFile.create({ data: { taskId: id, fileName, mime, size: bytes.length, bytes, byId: who.id, byName: who.name }, select: { id: true } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "attach", entity: "Task", entityId: id, clubId: task.siteId,
      summary: `Attached ${fileName} to ${asDefinition(task.definition).title} at ${task.site.name}`, details: { fileId: row.id } }, tx);
    return row;
  });
  refresh(id);
  return { ok: true, fileId: saved.id, fileName };
}

/** Add an ad hoc template's task to a site's day, open from the site's opening to its closing. */
export async function addTask(templateId: string, siteId: string, date: string): Promise<ActionResult & { id?: string }> {
  const who = await requireTasksActor();
  if (!(await allowedAt("tasks.complete", siteId, who))) return fail("Your role does not do tasks at that site.");
  const site = (await siteSettings([siteId])).get(siteId)!;
  if (!isDateOnly(date) || date > dayIn(site.timezone)) return fail("Tasks can be added for today or an earlier day.");
  if (site.status !== "live") return fail("This site is not live for Tasks yet.");
  if (site.closedDates.includes(date)) return fail("The site is closed that day.");
  const t = await prisma.taskTemplate.findFirst({ where: { id: templateId, orgId: who.orgId ?? undefined, status: "published", kind: "adhoc" } });
  if (!t || (t.siteIds.length && !t.siteIds.includes(siteId))) return fail("That task is not available at this site.");
  const club = { name: await siteName(siteId) };
  const id = await prisma.$transaction(async (tx) => {
    const row = await makeTaskNow(tx, who, t, siteId, date, site);
    await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "Task", entityId: row.id, clubId: siteId, summary: `Added ${t.title} at ${club.name} for ${date}` }, tx);
    return row.id;
  });
  refresh(id);
  return { ok: true, id };
}
