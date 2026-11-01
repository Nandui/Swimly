"use server";

import { revalidatePath } from "next/cache";
import { fail, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { isDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePlanActor } from "@/modules/plan/shared/access";
import { offsBetween, sessionsOf, shiftsAt } from "@/modules/plan/shared/data";
import { copyWeek, mondayOf, occurrencesOn, shiftIso } from "@/modules/plan/shared/model";
import { mayPlanDepartment, viewableSite } from "@/modules/plan/shared/scope";

/** Copy a department's last week into this one (owner, 29 October 2026): its shifts and, where the
 *  same session still runs, who filled it. Skips people marked off and never touches shifts already
 *  on this week. */
export async function copyLastWeek(siteId: string, departmentId: string, week: string): Promise<ActionResult & { copied?: number }> {
  const who = await requirePlanActor();
  if (!isDateOnly(week)) return fail("Choose a week.");
  const site = await viewableSite(siteId);
  if (!site) return fail("That site is not open.");
  if (!(await mayPlanDepartment(who, site.id, site.orgId, departmentId))) return fail("You can't plan that department at this site.");
  const monday = mondayOf(week);
  const [lastMonday, sunday] = [shiftIso(monday, -7), shiftIso(monday, 6)];
  const [last, here, sessions] = await Promise.all([
    shiftsAt(site.orgId, site.id, lastMonday, shiftIso(monday, -1)),
    shiftsAt(site.orgId, site.id, monday, sunday),
    sessionsOf(site.orgId, site.id, monday, sunday),
  ]);
  const mine = last.filter((s) => s.departmentId === departmentId);
  if (!mine.length) return fail("Last week has no shifts on this department's plan to copy.");
  const offs = await offsBetween(site.orgId, monday, sunday, mine.map((s) => s.userId));
  const copies = copyWeek(mine, {
    existing: here.map((s) => ({ userId: s.userId, date: s.date })),
    offOn: (userId, date) => offs.some((o) => o.userId === userId && o.firstDay <= date && o.lastDay >= date),
    runsOn: (sessionId, date) => occurrencesOn(sessions.filter((s) => s.id === sessionId), date).length > 0,
  });
  if (!copies.length) return fail("Everyone on last week's plan is already planned this week, or marked off.");
  await prisma.$transaction(async (tx) => {
    for (const s of copies) {
      await tx.planShift.create({ data: {
        orgId: site.orgId, siteId: site.id, departmentId, userId: s.userId, date: s.date, startMinutes: s.start, endMinutes: s.end, note: s.note,
        createdById: who.id, createdByName: who.name,
        blocks: { create: s.blocks.map((b) => ({ dutyId: b.dutyId, sessionId: b.sessionId, startMinutes: b.start, endMinutes: b.end })) },
      } });
    }
    await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "PlanShift", clubId: site.id,
      summary: `Copied ${copies.length} shift${copies.length === 1 ? "" : "s"} from the week of ${lastMonday} to the week of ${monday}` }, tx);
  });
  revalidatePath("/plan", "layout");
  return { ok: true, copied: copies.length };
}
