import "server-only";
import { liveSitesByOrganisation } from "@/lib/directory";
import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { dayIn, score } from "@/modules/tasks/shared/rules";
import { TASK_ROW, ensureTasks, siteSettings, stateOf } from "@/modules/tasks/shared/data";

/** Every site of every organisation: what the nightly cron makes tasks for. */
export async function ensureTasksEverywhere(days: readonly string[]) {
  let made = 0;
  for (const [orgId, ids] of await sitesByOrg()) made += await ensureTasks(orgId, ids, days);
  return made;
}
const sitesByOrg = () => liveSitesByOrganisation();

/** Freeze each site's score for a finished business day (the nightly cron, for yesterday), so
 *  history does not move when a task is reopened later. A day already frozen stays. */
export async function freezeScores(day: string) {
  let frozen = 0;
  for (const [, ids] of await sitesByOrg()) {
    const settings = await siteSettings(ids);
    for (const siteId of ids) {
      const site = settings.get(siteId)!;
      if (site.status !== "live" || site.closedDates.includes(day) || day >= dayIn(site.timezone)) continue;
      const rows = await prisma.task.findMany({ where: { siteId, date: parseDateOnly(day) }, select: { ...TASK_ROW } });
      const states = rows.map((t) => stateOf(t, new Date(), dayIn(site.timezone)));
      const made = await prisma.taskScoreSnapshot.createMany({ data: [{ siteId, date: parseDateOnly(day), score: score(states), count: states.length }], skipDuplicates: true });
      frozen += made.count;
    }
  }
  return frozen;
}
