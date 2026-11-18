import "server-only";
import { appOn, sitesWhereOn } from "@/lib/apps/switches";
import { activeStaffIds, staffSiteIds } from "@/lib/directory";
import { formatDayMonth, formatWeekday } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { preferenceChecks, readSettings } from "@/modules/staffing/shared/rules";

/** The preference check, for Turnfin Me's daily reminder email (D35): from the Monday a check opens
 *  until the day it closes, one line for everyone on the rota who works where Staffing is on,
 *  asking them to update the times they can work if they have changed. `ref` is the check's
 *  Monday, so each person is asked once a check; no answer means no change. */
export async function preferenceCheckReminderItems(on: string) {
  const rows = await prisma.staffingTeacher.findMany({ select: { userId: true, orgId: true } });
  const active = await activeStaffIds(rows.map((r) => r.userId));
  const items: { userId: string; kind: string; ref: string; line: string }[] = [];
  for (const orgId of new Set(rows.map((r) => r.orgId))) {
    if (!(await appOn("staffing", { orgId }))) continue;
    // Read here, not through shared/server.ts: this file loads with the front door, for a job nobody is signed in to.
    const settings = readSettings((await prisma.staffingSettings.findUnique({ where: { orgId }, select: { values: true } }))?.values ?? null);
    const { current } = preferenceChecks(on, settings);
    if (!current || on > current.closesOn) continue;
    const line = `If the times you can work have changed, update When I can work by ${formatWeekday(current.closesOn)} ${formatDayMonth(current.closesOn)} at ${settings.checkCloseTime}. If nothing has changed, do nothing: your times stay as they are.`;
    for (const row of rows.filter((r) => r.orgId === orgId && active.has(r.userId))) {
      const sites = await staffSiteIds(row.userId);
      if (sites.length && (await sitesWhereOn("staffing", sites, orgId)).length === 0) continue;
      items.push({ userId: row.userId, kind: "staffing-check", ref: `check:${current.opensOn}`, line });
    }
  }
  return items;
}
