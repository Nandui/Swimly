import "server-only";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { firstIssue, usualDayText, usualWeekSchema, WEEKDAYS } from "@/modules/plan/shared/rules";

/** A person's own usual week, written for the staff API (Turnfin Me) only (D34). The caller has
 *  already proved who `me` is; nobody sends another person's. Sending again replaces what they
 *  said before, and the activity log keeps each version in words. */
export async function saveMyUsualWeek(me: { id: string; name: string; orgId: string }, input: unknown): Promise<ActionResult> {
  const parsed = usualWeekSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const days = parsed.data.days;
  const data = { modes: days.map((d) => d.mode), starts: days.map((d) => d.start ?? 0), ends: days.map((d) => d.end ?? 0) };
  const limits = days.flatMap((d, i) => { const text = usualDayText(d); return text ? [`${WEEKDAYS[i]}: ${text.toLowerCase()}`] : []; });
  await prisma.$transaction(async (tx) => {
    const row = await tx.planAvailability.upsert({ where: { userId: me.id }, update: data, create: { ...data, orgId: me.orgId, userId: me.id } });
    await logAudit({ actorId: me.id, actorName: me.name, action: "update", entity: "PlanAvailability", entityId: row.id, clubId: null,
      summary: `Said when they can usually work (Turnfin Me): ${limits.length ? limits.join("; ") : "any time, every day"}` }, tx);
  });
  return ok();
}
