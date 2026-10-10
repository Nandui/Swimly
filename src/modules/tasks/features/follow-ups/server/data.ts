import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { asDefinition, followUpTemplates, iso, tasksSites } from "@/modules/tasks/shared/data";

/** Follow-up actions at one site: the open ones first, then the latest resolved. */
export async function taskActions(siteParam: string | undefined) {
  const { who, sites, home } = await tasksSites();
  const site = sites.find((s) => s.id === (siteParam ?? home));
  if (siteParam && !site) notFound();
  if (!site) return { who, sites, site: null, open: [], resolved: [], actionTemplates: [] } as const;
  const select = { id: true, title: true, dueOn: true, status: true, raisedByName: true, createdAt: true, resolvedAt: true, resolvedByName: true, resolution: true, followUpTaskId: true,
    task: { select: { id: true, date: true, definition: true } } } as const;
  const [open, resolved, actionTemplates] = await Promise.all([
    prisma.taskAction.findMany({ where: { siteId: site.id, status: "open" }, orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }], select }),
    prisma.taskAction.findMany({ where: { siteId: site.id, status: "resolved" }, orderBy: { resolvedAt: "desc" }, take: 30, select }),
    followUpTemplates(who, site.id),
  ]);
  const name = (a: (typeof open)[number]) => ({ ...a, from: a.task ? { id: a.task.id, title: asDefinition(a.task.definition).title, date: iso(a.task.date) } : null });
  return { who, sites, site, open: open.map(name), resolved: resolved.map(name), actionTemplates } as const;
}
