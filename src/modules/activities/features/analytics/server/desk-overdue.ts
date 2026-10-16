import { addDaysIso } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  billingChecksQuery, cancellationBillingQuery, parentRequestsQuery, readyNowQuery, type JobRow,
} from "@/modules/activities/features/analytics/server/desk-queries";
import { jobsFromRows } from "@/modules/activities/features/analytics/server/desk";

/** Desk jobs at these sites now past their target, for the Overview's Needs attention. */
export async function deskOverdue(clubIds: string[], now: Date) {
  const rows = await prisma.$transaction(async tx => (await Promise.all([
    tx.$queryRaw<JobRow[]>(parentRequestsQuery(clubIds, addDaysIso(now.toISOString().slice(0, 10), -1))),
    tx.$queryRaw<JobRow[]>(billingChecksQuery(clubIds, addDaysIso(now.toISOString().slice(0, 10), -1))),
    tx.$queryRaw<JobRow[]>(cancellationBillingQuery(clubIds, addDaysIso(now.toISOString().slice(0, 10), -1))),
    tx.$queryRaw<JobRow[]>(readyNowQuery(clubIds)),
  ])).flat());
  return jobsFromRows(rows.filter(r => r.open), now).filter(j => j.onTime === false).length;
}
