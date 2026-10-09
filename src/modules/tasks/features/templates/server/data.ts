import "server-only";
import { notFound } from "next/navigation";
import { allRoles } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { requireTasksActor } from "@/modules/tasks/shared/access";
import { type LogMode, type TemplateKind } from "@/modules/tasks/shared/rules";
import { asFields, asSchedules, templateSites, textMatch } from "@/modules/tasks/shared/data";

// ---------------------------------------------------------------------------
// Templates, sites and activity (Manage, Review)
// ---------------------------------------------------------------------------

const TEMPLATE_FILTERS = ["all", "published", "draft", "archived"] as const;
/** The organisation's templates (the task library), for the people who write them, with the
 *  prototype's filters: words, state and tag. */
export async function taskTemplates(input: { q?: string; state?: string; tag?: string } = {}) {
  const who = await requireTasksActor();
  if (!who.manage) notFound();
  const state = (TEMPLATE_FILTERS as readonly string[]).includes(input.state ?? "") ? input.state! : "all";
  const q = (input.q ?? "").trim().slice(0, 80), tag = (input.tag ?? "").trim();
  const [templates, sites, roles] = await Promise.all([
    prisma.taskTemplate.findMany({ where: { orgId: who.orgId ?? undefined }, orderBy: [{ status: "asc" }, { title: "asc" }],
      select: { id: true, title: true, status: true, kind: true, siteIds: true, roleIds: true, restricted: true, tags: true, priority: true, schedules: true, updatedAt: true } }),
    templateSites(who),
    templateRoles(),
  ]);
  const shaped = templates.map((t) => ({ ...t, kind: t.kind as TemplateKind, schedules: asSchedules(t.schedules) }));
  return {
    who, sites, roles, filters: { q, state, tag }, total: shaped.length,
    tags: [...new Set(shaped.flatMap((t) => t.tags))].sort(),
    templates: shaped.filter((t) => (state === "all" || t.status === state) && textMatch(q, t) && (!tag || t.tags.includes(tag))),
  };
}
const templateRoles = () => allRoles();

/** One template to edit, or a new one, with the sites and roles to choose from. */
export async function taskTemplate(id: string | null) {
  const who = await requireTasksActor();
  if (!who.manage) notFound();
  const [template, sites, roles] = await Promise.all([
    id ? prisma.taskTemplate.findFirst({ where: { id, orgId: who.orgId ?? undefined } }) : null,
    templateSites(who),
    templateRoles(),
  ]);
  if (id && !template) notFound();
  return {
    who, sites, roles,
    template: template ? {
      id: template.id, status: template.status as "draft" | "published" | "archived", version: template.version, title: template.title, description: template.description,
      kind: template.kind as TemplateKind, siteIds: template.siteIds, roleIds: template.roleIds, restricted: template.restricted, tags: template.tags, priority: template.priority,
      checklist: template.checklist, fields: asFields(template.fields), minimumRecords: template.minimumRecords, logMode: template.logMode as LogMode,
      schedules: asSchedules(template.schedules), requiresComment: template.requiresComment, requiresApproval: template.requiresApproval,
      notifyCompletion: template.notifyCompletion, notifyException: template.notifyException,
      used: await prisma.task.count({ where: { templateId: template.id } }),
    } : null,
  };
}
