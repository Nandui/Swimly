import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { AuthorizationError } from "@/lib/authz";
import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";
import type { PermissionKey } from "@/lib/staff/permissions";
import { type TasksActor } from "@/modules/tasks/shared/access";
import { definitionOf, type SiteSettings } from "@/modules/tasks/shared/data";
import { dayIn, zonedInstant } from "@/modules/tasks/shared/rules";

export const json = (v: unknown) => v as Prisma.InputJsonValue;

export function refresh(taskId?: string) {
  revalidatePath("/tasks");
  revalidatePath("/tasks/actions");
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

/** The capability at a site, as a result rather than a throw. */
export async function allowedAt(cap: PermissionKey, siteId: string, who: TasksActor) {
  try {
    await requireCapFor(cap, { siteId, orgId: who.orgId });
    return true;
  } catch (error) {
    if (error instanceof AuthorizationError) return false;
    throw error;
  }
}
export const loadTask = (id: string, orgId: string | null) => prisma.task.findFirst({
  where: { id, orgId: orgId ?? undefined },
  select: { id: true, siteId: true, date: true, status: true, version: true, definition: true, checks: true, records: true, completedById: true, approvedAt: true, site: { select: { name: true } } },
});

/** Make one task from a template at a site on a day, from its opening (or now, today) to its
 *  closing: an ad hoc task someone adds, or the follow-up task of an action. */
export async function makeTaskNow(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], who: TasksActor, t: Parameters<typeof definitionOf>[0] & { id: string; checklist: string[] }, siteId: string, date: string, site: SiteSettings) {
  const now = new Date();
  let startsAt = zonedInstant(date, site.opening, site.timezone), dueAt = zonedInstant(site.closing <= site.opening ? addDaysIso(date, 1) : date, site.closing, site.timezone);
  if (date === dayIn(site.timezone, now) && now > startsAt) startsAt = now;
  // Added after closing: due by the end of the day instead.
  if (dueAt <= startsAt) dueAt = zonedInstant(date, "23:59", site.timezone);
  return tx.task.create({
    data: { orgId: who.orgId ?? "", templateId: t.id, siteId, date: parseDateOnly(date), scheduleKey: `added:${crypto.randomUUID()}`, startsAt, dueAt,
      definition: json(definitionOf(t)), checks: t.checklist.map(() => false), addedByName: who.name },
    select: { id: true },
  });
}
export const addDaysIso = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
