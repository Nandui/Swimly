"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { mayFor, requireCapFor } from "@/lib/policy/session";
import type { PermissionKey } from "@/lib/staff/permissions";
import { requireTasksActor, type TasksActor } from "@/lib/tasks/access";
import { asDefinition, definitionOf, ensureTasks, isMine } from "@/lib/tasks/data";
import {
  FIELD_TYPES, REPEATS, completionProblems, exceptions, isClock, templateProblems, zonedInstant,
  type TaskField, type TaskRecord, type TaskSchedule,
} from "@/lib/tasks/rules";

/** Tasks' writes (docs/tasks.md). Doing a task needs `tasks.complete` at its
 *  site and, when it is aimed at roles, one of them (reviewers may always step
 *  in); approving, reopening, not applicable and resolving actions need
 *  `tasks.review` there, and nobody approves their own; templates need
 *  `tasks.manage`. Every change checks the version it was made from and is
 *  audited in the same transaction. */

const STALE = "Someone else changed this task. Reload the page to see their changes, then try again.";
const STALE_TEMPLATE = "Someone else changed this template. Reload the page to see their changes, then try again.";
const json = (v: unknown) => v as Prisma.InputJsonValue;

function refresh(taskId?: string) {
  revalidatePath("/tasks");
  revalidatePath("/tasks/actions");
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

/** The capability at a site, as a result rather than a throw. */
async function allowedAt(cap: PermissionKey, siteId: string, who: TasksActor) {
  try {
    await requireCapFor(cap, { siteId, orgId: who.orgId });
    return true;
  } catch (error) {
    if (error instanceof AuthorizationError) return false;
    throw error;
  }
}

type Loaded = { ok: true; who: TasksActor; task: NonNullable<Awaited<ReturnType<typeof loadTask>>> } | { ok: false; error: string };
const loadTask = (id: string, orgId: string | null) => prisma.task.findFirst({
  where: { id, orgId: orgId ?? undefined },
  select: { id: true, siteId: true, date: true, status: true, version: true, definition: true, checks: true, records: true, completedById: true, approvedAt: true, site: { select: { name: true } } },
});

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

const roleIdOf = async (userId: string) => (await prisma.user.findUnique({ where: { id: userId }, select: { staffRoleId: true } }))?.staffRoleId ?? null;

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

/** Add a template without a schedule as a task for the day, due by the end of it. */
export async function addTask(templateId: string, siteId: string, date: string): Promise<ActionResult & { id?: string }> {
  const who = await requireTasksActor();
  if (!isDateOnly(date) || date > today()) return fail("Tasks can be added for today or an earlier day.");
  if (!(await allowedAt("tasks.complete", siteId, who))) return fail("Your role does not do tasks at that site.");
  const t = await prisma.taskTemplate.findFirst({ where: { id: templateId, orgId: who.orgId ?? undefined, status: "published" } });
  if (!t || (t.siteIds.length && !t.siteIds.includes(siteId))) return fail("That task is not available at this site.");
  const site = await prisma.club.findUniqueOrThrow({ where: { id: siteId }, select: { name: true } });
  const now = new Date();
  const id = await prisma.$transaction(async (tx) => {
    const row = await tx.task.create({
      data: { orgId: who.orgId ?? "", templateId, siteId, date: parseDateOnly(date), scheduleKey: `added:${crypto.randomUUID()}`,
        startsAt: date === today(now) ? now : zonedInstant(date, "00:00"), dueAt: zonedInstant(date, "23:59"),
        definition: json(definitionOf(t)), checks: t.checklist.map(() => false), addedByName: who.name },
      select: { id: true },
    });
    await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "Task", entityId: row.id, clubId: siteId, summary: `Added ${t.title} at ${site.name} for ${date}` }, tx);
    return row.id;
  });
  refresh(id);
  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// Follow-up actions
// ---------------------------------------------------------------------------

const actionSchema = z.object({
  title: z.string().trim().min(3, "Say what needs to happen.").max(300),
  dueOn: z.string().refine((v) => v === "" || isDateOnly(v), "Give the date as a date.").default(""),
});

/** Raise a follow-up action, from a task or on its own at a site. */
export async function raiseTaskAction(input: { siteId: string; taskId?: string | null; title: string; dueOn?: string }): Promise<ActionResult> {
  const who = await requireTasksActor();
  const parsed = actionSchema.safeParse(input);
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
  await prisma.$transaction(async (tx) => {
    const a = await tx.taskAction.create({
      data: { orgId: who.orgId ?? "", siteId, taskId: input.taskId || null, title: parsed.data.title, dueOn: parsed.data.dueOn ? parseDateOnly(parsed.data.dueOn) : null, raisedById: who.id, raisedByName: who.name },
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

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const id64 = z.string().trim().min(1).max(64);
const fieldSchema = z.object({
  id: id64,
  label: z.string().trim().max(200),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  options: z.array(z.string().trim().max(120)).max(30).optional(),
  min: z.number().finite().nullable().optional(),
  max: z.number().finite().nullable().optional(),
  unit: z.string().trim().max(20).optional(),
  warning: z.string().trim().max(300).optional(),
  needsAction: z.boolean().optional(),
});
const scheduleSchema = z.object({
  id: id64,
  repeat: z.enum(REPEATS),
  every: z.number().int(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  from: z.string(),
  start: z.string().refine(isClock, "Give a start time like 08:00."),
  due: z.string().refine(isClock, "Give a due time like 09:00."),
});
const templateSchema = z.object({
  title: z.string().trim().max(120, "Keep the title under 120 characters."),
  description: z.string().trim().max(2000).default(""),
  siteIds: z.array(id64).max(100),
  roleIds: z.array(id64).max(100),
  tags: z.array(z.string().trim().min(1).max(40)).max(10, "Keep it to 10 tags."),
  priority: z.boolean(),
  checklist: z.array(z.string().trim().max(300)).max(60, "Keep the checklist to 60 items."),
  fields: z.array(fieldSchema).max(40, "Keep it to 40 questions."),
  minimumRecords: z.number().int(),
  schedules: z.array(scheduleSchema).max(12, "Keep it to 12 schedules."),
  requiresComment: z.boolean(),
  requiresApproval: z.boolean(),
});
export type TemplateInput = z.input<typeof templateSchema>;

function tidy(data: z.output<typeof templateSchema>) {
  const fields: TaskField[] = data.fields.map((f) => ({
    id: f.id, label: f.label, type: f.type, required: f.type === "heading" ? false : f.required,
    ...(f.type === "choice" ? { options: (f.options ?? []).filter(Boolean) } : {}),
    ...(f.type === "number" ? { min: f.min ?? null, max: f.max ?? null, unit: f.unit ?? "", warning: f.warning ?? "", needsAction: !!f.needsAction } : {}),
  }));
  const schedules: TaskSchedule[] = data.schedules.map((s) => ({ ...s, every: s.repeat === "once" ? 1 : s.every, weekdays: s.repeat === "weekly" ? [...new Set(s.weekdays)].sort() : [] }));
  return { ...data, tags: [...new Set(data.tags)], fields, schedules };
}

/** Save a template; `publish` also checks it and makes it live. A new template starts as a draft. */
export async function saveTaskTemplate(id: string | null, version: number | null, input: TemplateInput, publish: boolean): Promise<ActionResult & { id?: string }> {
  const who = await requireTasksActor();
  if (!who.manage || !who.orgId) return fail("Writing task templates needs Tasks: Manage.");
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = tidy(parsed.data);
  if (!data.title) return fail("Give the task a title.");
  const problems = templateProblems(data);
  if (publish && problems.length) return fail(problems.join(" "));
  const [sites, roles] = await Promise.all([
    prisma.club.count({ where: { id: { in: data.siteIds }, orgId: who.orgId, archivedAt: null } }),
    prisma.staffRole.count({ where: { id: { in: data.roleIds } } }),
  ]);
  if (sites !== new Set(data.siteIds).size) return fail("One of those sites no longer exists.");
  if (roles !== new Set(data.roleIds).size) return fail("One of those roles no longer exists.");
  const row = { ...data, fields: json(data.fields), schedules: json(data.schedules) };
  const result = await prisma.$transaction(async (tx) => {
    let savedId = id;
    if (id) {
      const current = await tx.taskTemplate.findFirst({ where: { id, orgId: who.orgId! }, select: { status: true, publishedAt: true } });
      if (!current) return fail("That template no longer exists.");
      if (current.status === "archived") return fail("Restore it before changing it.");
      const going = publish || current.status === "published";
      const moved = await tx.taskTemplate.updateMany({
        where: { id, version: version ?? -1 },
        data: { ...row, status: going ? "published" : "draft", publishedAt: going ? current.publishedAt ?? new Date() : current.publishedAt, version: { increment: 1 } },
      });
      if (moved.count !== 1) return fail(STALE_TEMPLATE);
    } else {
      savedId = (await tx.taskTemplate.create({
        data: { ...row, orgId: who.orgId!, status: publish ? "published" : "draft", publishedAt: publish ? new Date() : null, createdByName: who.name },
        select: { id: true },
      })).id;
    }
    await logAudit({ actorId: who.id, actorName: who.name, action: id ? "update" : "create", entity: "TaskTemplate", entityId: savedId!, clubId: null,
      summary: `${id ? "Changed" : "Wrote"} the task template ${data.title}${publish ? " and published it" : ""}` }, tx);
    return { ok: true as const, id: savedId! };
  });
  if (result.ok) {
    revalidatePath("/tasks/templates");
    revalidatePath(`/tasks/templates/${result.id}`);
    // Today's tasks from a template published just now.
    if (publish) {
      const live = await prisma.club.findMany({ where: { orgId: who.orgId, archivedAt: null }, select: { id: true } });
      await ensureTasks(who.orgId, live.map((s) => s.id), [today()]);
      revalidatePath("/tasks");
    }
  }
  return result;
}

/** Archive a template (it makes no more tasks; tasks already made stay) or restore it as a draft. */
export async function setTaskTemplateArchived(id: string, archived: boolean): Promise<ActionResult> {
  const who = await requireTasksActor();
  if (!who.manage || !who.orgId) return fail("Writing task templates needs Tasks: Manage.");
  const t = await prisma.taskTemplate.findFirst({ where: { id, orgId: who.orgId }, select: { title: true, status: true } });
  if (!t) return fail("That template no longer exists.");
  if (archived === (t.status === "archived")) return ok();
  await prisma.$transaction(async (tx) => {
    await tx.taskTemplate.update({ where: { id }, data: { status: archived ? "archived" : "draft", version: { increment: 1 } } });
    await logAudit({ actorId: who.id, actorName: who.name, action: archived ? "archive" : "restore", entity: "TaskTemplate", entityId: id, clubId: null,
      summary: `${archived ? "Archived" : "Restored"} the task template ${t.title}` }, tx);
  });
  revalidatePath("/tasks/templates");
  revalidatePath(`/tasks/templates/${id}`);
  return ok();
}

/** A copy of a template as a new draft, to start a similar one. */
export async function copyTaskTemplate(id: string): Promise<ActionResult & { id?: string }> {
  const who = await requireTasksActor();
  if (!who.manage || !who.orgId) return fail("Writing task templates needs Tasks: Manage.");
  const t = await prisma.taskTemplate.findFirst({ where: { id, orgId: who.orgId } });
  if (!t) return fail("That template no longer exists.");
  const copy = await prisma.$transaction(async (tx) => {
    const row = await tx.taskTemplate.create({
      data: { orgId: t.orgId, title: `${t.title} (copy)`.slice(0, 120), description: t.description, siteIds: t.siteIds, roleIds: t.roleIds, tags: t.tags, priority: t.priority,
        checklist: t.checklist, fields: json(t.fields), minimumRecords: t.minimumRecords, schedules: json(t.schedules), requiresComment: t.requiresComment, requiresApproval: t.requiresApproval,
        createdByName: who.name },
      select: { id: true },
    });
    await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "TaskTemplate", entityId: row.id, clubId: null, summary: `Copied the task template ${t.title}` }, tx);
    return row;
  });
  revalidatePath("/tasks/templates");
  return { ok: true, id: copy.id };
}
