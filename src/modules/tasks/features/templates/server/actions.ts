"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireTasksActor } from "@/modules/tasks/shared/access";
import { ensureTasks, siteSettings } from "@/modules/tasks/shared/data";
import {
  FIELD_TYPES, LOG_MODES, REPEATS, SCHEDULED_KINDS, TEMPLATE_KINDS, dayIn, isScheduleTime, templateProblems, type TaskField, type TaskSchedule,
} from "@/modules/tasks/shared/rules";
import { json } from "@/modules/tasks/shared/writes";

const STALE_TEMPLATE = "Someone else changed this template. Reload the page to see their changes, then try again.";

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
  start: z.string().refine(isScheduleTime, "Give a start time like 08:00, or the site's opening or closing."),
  due: z.string().refine(isScheduleTime, "Give a due time like 09:00, or the site's opening or closing."),
});
const templateSchema = z.object({
  title: z.string().trim().max(120, "Keep the title under 120 characters."),
  description: z.string().trim().max(2000).default(""),
  siteIds: z.array(id64).max(100),
  kind: z.enum(TEMPLATE_KINDS),
  roleIds: z.array(id64).max(100),
  restricted: z.boolean(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10, "Keep it to 10 tags."),
  priority: z.boolean(),
  checklist: z.array(z.string().trim().max(300)).max(60, "Keep the checklist to 60 items."),
  fields: z.array(fieldSchema).max(40, "Keep it to 40 questions."),
  minimumRecords: z.number().int(),
  logMode: z.enum(LOG_MODES),
  notifyCompletion: z.boolean(),
  notifyException: z.boolean(),
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
  // Only scheduled kinds keep schedules; a one-off template's schedules happen once.
  const schedules: TaskSchedule[] = !SCHEDULED_KINDS.includes(data.kind) ? [] : data.schedules.map((s) => {
    const repeat = data.kind === "once" ? "once" : s.repeat;
    return { ...s, repeat, every: repeat === "once" ? 1 : s.every, weekdays: repeat === "weekly" ? [...new Set(s.weekdays)].sort() : [] };
  });
  // A form keeps one record.
  return { ...data, tags: [...new Set(data.tags)], fields, schedules, minimumRecords: data.logMode === "form" ? 1 : data.minimumRecords };
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
    // Today's tasks from a template published just now (each site's today).
    if (publish) {
      const live = await prisma.club.findMany({ where: { orgId: who.orgId, archivedAt: null }, select: { id: true } });
      const settings = await siteSettings(live.map((s) => s.id));
      await ensureTasks(who.orgId, live.map((s) => s.id), [...new Set([today(), ...[...settings.values()].map((x) => dayIn(x.timezone))])]);
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
      data: { orgId: t.orgId, title: `${t.title} (copy)`.slice(0, 120), description: t.description, kind: t.kind, siteIds: t.siteIds, roleIds: t.roleIds, restricted: t.restricted,
        tags: t.tags, priority: t.priority, checklist: t.checklist, fields: json(t.fields), minimumRecords: t.minimumRecords, logMode: t.logMode, schedules: json(t.schedules),
        requiresComment: t.requiresComment, requiresApproval: t.requiresApproval, notifyCompletion: t.notifyCompletion, notifyException: t.notifyException,
        createdByName: who.name },
      select: { id: true },
    });
    await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "TaskTemplate", entityId: row.id, clubId: null, summary: `Copied the task template ${t.title}` }, tx);
    return row;
  });
  revalidatePath("/tasks/templates");
  return { ok: true, id: copy.id };
}
