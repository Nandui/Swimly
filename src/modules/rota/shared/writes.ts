import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { currentActor, mayFor } from "@/lib/policy/session";
import { canChange } from "@/modules/rota/shared/access";
import { ROTA_CHANGE_REASONS, mondayOf } from "@/modules/rota/shared/constants";
import type { Prisma } from "@/generated/prisma/client";

/** Rota writes (owner decisions, 6 October 2026). Plan changes the days after today for the
 *  departments the person belongs to; Run changes any day for every department. Nothing is
 *  refused for a warning (an expired qualification, a double booking): those show on the plan.
 *  A change to today or an earlier day asks for its reason and goes in the day's log with an
 *  "Update Timepoint" follow-up. Once a week is shared, the people a change moves are told. */

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const CLASSES = "activities.classes";

export const changeSchema = z.object({
  reason: z.enum(["", ...ROTA_CHANGE_REASONS]).default(""),
  note: z.string().trim().max(200, "Keep the note under 200 characters.").default(""),
});
export const NEEDS_REASON = "This day has come, so the change goes in the day's log. Say why it changed.";

export type Allowed = { ok: true; actor: { id: string; name: string }; site: { id: string; name: string; orgId: string }; live: boolean } | { ok: false; error: string };

/** May the signed-in person change this department's plan on this day at this site? */
export async function allowedFor(siteId: string, date: string, departmentId: string): Promise<Allowed> {
  const site = await prisma.club.findFirst({ where: { id: siteId, archivedAt: null }, select: { id: true, name: true, orgId: true } });
  if (!site?.orgId) return { ok: false, error: "That site is not open." };
  const actor = await currentActor();
  const resource = { siteId, orgId: site.orgId };
  const [run, plan] = await Promise.all([mayFor("rota.manage", resource), mayFor("rota.plan", resource)]);
  if (!run && !plan) return { ok: false, error: "You can only plan the rota at the sites your role covers." };
  const now = today();
  const member = new Set((await prisma.userDepartment.findMany({ where: { userId: actor.id }, select: { departmentId: true } })).map((m) => m.departmentId));
  if (!canChange({ plan, run }, date, now, departmentId, member)) {
    return { ok: false, error: date <= now ? "Today and earlier days are changed by the duty manager." : "You plan only the departments you belong to." };
  }
  return { ok: true, actor: { id: actor.id, name: actor.name }, site: { id: site.id, name: site.name, orgId: site.orgId }, live: date <= now };
}

export function refresh() {
  revalidatePath("/rota");
  revalidatePath("/rota/today");
  revalidatePath("/rota/overview");
}

/** Is this department's week shared with its staff? Then the people a change moves are told. */
export async function shared(tx: Prisma.TransactionClient | typeof prisma, siteId: string, departmentId: string, date: string) {
  return !!(await tx.rotaWeekShare.findUnique({ where: { siteId_departmentId_monday: { siteId, departmentId, monday: parseDateOnly(mondayOf(date)) } }, select: { id: true } }));
}

/** The absence a cover change covers: the person taken off is off that day. */
export async function coveredAbsence(tx: Prisma.TransactionClient, userId: string | null, date: string) {
  if (!userId) return null;
  const on = parseDateOnly(date);
  return (await tx.rotaAbsence.findFirst({ where: { userId, withdrawnAt: null, firstDay: { lte: on }, OR: [{ lastDay: null }, { lastDay: { gte: on } }] }, select: { id: true } }))?.id ?? null;
}

export async function logLive(tx: Prisma.TransactionClient, at: Extract<Allowed, { ok: true }>, date: string, kind: string, summary: string, userId: string | null, change: z.output<typeof changeSchema>, coverFor: string | null = null) {
  await tx.rotaLog.create({ data: {
    orgId: at.site.orgId, siteId: at.site.id, date: parseDateOnly(date), kind, summary, userId, reason: change.reason, note: change.note,
    absenceId: change.reason === "cover" ? await coveredAbsence(tx, coverFor, date) : null, byId: at.actor.id, byName: at.actor.name,
  } });
}
