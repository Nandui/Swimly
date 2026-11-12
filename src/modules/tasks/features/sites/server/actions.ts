"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { liveSiteById } from "@/lib/directory";
import { isDateOnly, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireTasksActor } from "@/modules/tasks/shared/access";
import { SITE_STATUSES, TIMEZONES, isClock } from "@/modules/tasks/shared/rules";

// ---------------------------------------------------------------------------
// Sites: Tasks' settings for each site (Manage)
// ---------------------------------------------------------------------------

const siteSchema = z.object({
  status: z.enum(SITE_STATUSES),
  area: z.string().trim().max(60, "Keep the area under 60 characters.").default(""),
  timezone: z.enum(TIMEZONES),
  opening: z.string().refine(isClock, "Give the opening time like 06:00."),
  closing: z.string().refine(isClock, "Give the closing time like 22:00."),
  closedDates: z.array(z.string()).max(366, "Keep it to a year of closed dates."),
});
export type TaskSiteInput = z.input<typeof siteSchema>;

/** A site's Tasks settings: live or not, its area and time zone, business hours (schedules at
 *  opening or closing use them) and closed dates (no tasks are made then). Tasks already made
 *  keep their times. */
export async function saveTaskSite(siteId: string, input: TaskSiteInput): Promise<ActionResult> {
  const who = await requireTasksActor();
  if (!who.manage || !who.orgId) return fail("Changing a site's Tasks settings needs Tasks: Manage.");
  const parsed = siteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const dates = [...new Set(parsed.data.closedDates.map((d) => d.trim()).filter(Boolean))].sort();
  const bad = dates.find((d) => !isDateOnly(d));
  if (bad) return fail(`${bad} is not a date. Use dates like 2026-12-25.`);
  const live = await liveSiteById(siteId);
  const club = live && live.orgId === who.orgId ? live : null;
  if (!club) return fail("That site no longer exists.");
  const data = { ...parsed.data, closedDates: dates.map(parseDateOnly) };
  await prisma.$transaction(async (tx) => {
    await tx.taskSite.upsert({ where: { siteId }, create: { siteId, ...data }, update: data });
    await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "TaskSite", entityId: siteId, clubId: siteId,
      summary: `Changed ${club.name}'s Tasks settings: ${parsed.data.status}, ${parsed.data.opening} to ${parsed.data.closing}, ${dates.length} closed ${dates.length === 1 ? "date" : "dates"}` }, tx);
  });
  revalidatePath("/tasks/sites");
  revalidatePath("/tasks");
  return ok();
}
