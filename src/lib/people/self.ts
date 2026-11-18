import "server-only";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { usualWeekOf, usualWeekSchema, usualWeekText } from "@/lib/people/usual-week";

/** A person's own usual week, written for the staff API (Turnfin Me) only (D34, D35). The caller
 *  has already proved who `me` is; nobody sends another person's. Sending again replaces what they
 *  said before, and the activity log keeps each version in words. Sending the same week again
 *  changes nothing, so `updatedAt` is when their week last really changed. */
export async function saveMyUsualWeek(me: { id: string; name: string; orgId: string }, input: unknown): Promise<ActionResult> {
  const parsed = usualWeekSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details and try again.");
  const days = parsed.data.days;
  const data = { modes: days.map((d) => d.mode), starts: days.map((d) => d.start ?? 0), ends: days.map((d) => d.end ?? 0) };
  await prisma.$transaction(async (tx) => {
    const before = await tx.staffUsualWeek.findUnique({ where: { userId: me.id }, select: { modes: true, starts: true, ends: true } });
    if (before && usualWeekText(usualWeekOf(before)) === usualWeekText(days)) return;
    const row = await tx.staffUsualWeek.upsert({ where: { userId: me.id }, update: { ...data, updatedAt: new Date() }, create: { ...data, orgId: me.orgId, userId: me.id } });
    await logAudit({ actorId: me.id, actorName: me.name, action: "update", entity: "StaffUsualWeek", entityId: row.id, clubId: null,
      summary: `Said when they can usually work (Turnfin Me): ${usualWeekText(days)}` }, tx);
  });
  return ok();
}
