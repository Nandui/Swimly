import { auditEvents, auditWorkload } from "@/lib/audit";
import { sitesByIds } from "@/lib/directory";
import { addDaysIso } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { deskMeasuresFor } from "@/modules/contributions";
import {
  billingChecksQuery, bookingsQuery, cancellationBillingQuery, followUpsQuery, parentRequestsQuery, placeReasonsQuery,
  readyMovesQuery, readyNowQuery, swimmerDetailsQuery, waitingNowQuery,
  type BookingRow, type FollowUpRow, type JobRow, type PlaceReasonRow, type ReadyMoveRow, type SwimmerDetailRow,
} from "@/modules/activities/features/analytics/server/desk-queries";
import {
  buildDesk, buildDeskPerson, DESK_MODULES, jobsFromMeasures, jobsFromRows, readyMoveJobs, waitlistJobs, type Job,
} from "@/modules/activities/features/analytics/server/desk";
import { context, type ReportParams } from "@/modules/activities/features/analytics/server/insights-data";

/** Everything the desk did at these sites in the period and the one before, and every job still waiting.
 *  The log is read through Core and other modules' timed jobs through `deskMeasuresFor`, so nothing here
 *  reads another module's tables. */
async function deskData(params: ReportParams, now: Date) {
  const ctx = await context(params, now);
  const { period, clubIds } = ctx;
  const from = period.previousStart, to = period.today;
  // Waits that began before the window still end in it: look further back for their start.
  const lookback = addDaysIso(from, -180);
  const [work, enrolEvents, studentEvents, [jobRows, readyMoves, followUps, bookings]] = await Promise.all([
    auditWorkload({ modules: DESK_MODULES, siteIds: clubIds, from, to }),
    auditEvents({ entity: "Enrolment", actions: ["waitlist", "enrol", "transfer", "withdraw", "schedule-withdrawal"], siteIds: clubIds, from: lookback, to }),
    auditEvents({ entity: "Student", actions: ["create"], siteIds: null, from: period.start, to }),
    // The swim school's own records, read at one moment on one connection.
    prisma.$transaction(async tx => Promise.all([
      Promise.all([
        tx.$queryRaw<JobRow[]>(parentRequestsQuery(clubIds, period.start)),
        tx.$queryRaw<JobRow[]>(billingChecksQuery(clubIds, period.start)),
        tx.$queryRaw<JobRow[]>(cancellationBillingQuery(clubIds, period.start)),
        tx.$queryRaw<JobRow[]>(readyNowQuery(clubIds)),
        tx.$queryRaw<JobRow[]>(waitingNowQuery(clubIds)),
      ]).then(lists => lists.flat()),
      tx.$queryRaw<ReadyMoveRow[]>(readyMovesQuery(clubIds, period.start)),
      tx.$queryRaw<FollowUpRow[]>(followUpsQuery(clubIds, period.start)),
      tx.$queryRaw<BookingRow[]>(bookingsQuery(clubIds, period.start)),
    ]), { isolationLevel: "RepeatableRead", timeout: 30_000 }),
  ]);

  // Other modules' timed jobs, after the rest so their reads do not crowd the connection pool.
  const measures = await deskMeasuresFor({ siteIds: clubIds, from: period.start, to, now });

  // Swimmers are shared across sites: count those added by people working at these sites.
  const here = new Set(work.map(w => w.actorName));
  const added = studentEvents.filter(e => here.has(e.actorName));
  const detailsSql = swimmerDetailsQuery(added.map(e => e.entityId));
  const details = detailsSql ? await prisma.$queryRaw<SwimmerDetailRow[]>(detailsSql) : [];
  const detailOf = new Map(details.map(d => [d.id, d]));
  const unenrolEvents = enrolEvents.filter(e => (e.action === "withdraw" || e.action === "schedule-withdrawal") && e.at.toISOString().slice(0, 10) >= period.start);
  const reasonsSql = placeReasonsQuery([...new Set(unenrolEvents.map(e => e.entityId))]);
  const reasons = reasonsSql ? await prisma.$queryRaw<PlaceReasonRow[]>(reasonsSql) : [];
  const reasonOf = new Map(reasons.map(r => [r.id, r]));

  const jobs: Job[] = [
    ...jobsFromRows(jobRows, now),
    ...waitlistJobs(enrolEvents.filter(e => e.action === "waitlist" || e.action === "enrol"), period.start, period.end),
    ...readyMoveJobs(readyMoves, enrolEvents.filter(e => e.action === "transfer")),
    ...jobsFromMeasures(measures.items),
  ];
  const desk = buildDesk({
    period, work, jobs, followUps, bookings,
    newSwimmers: added.map(event => ({ event, details: detailOf.get(event.entityId) })),
    unenrols: unenrolEvents.map(event => ({ event, place: reasonOf.get(event.entityId) })),
    placeEvents: enrolEvents.filter(e => ["enrol", "transfer", "withdraw"].includes(e.action)),
  });
  const sites = await sitesByIds(jobs.map(j => j.siteId));
  const siteName = (id: string | null) => (id ? sites.get(id)?.name ?? "Removed site" : null);
  return { ctx, desk, jobs, failed: measures.failed, siteName };
}

/** The reception page: the whole desk, then every person. */
export async function getDeskInsights(params: ReportParams, now = new Date()) {
  const { ctx, desk, failed, siteName } = await deskData(params, now);
  const { detail: _detail, ...team } = desk;
  void _detail;
  return {
    ...ctx, session: undefined, failed,
    desk: { ...team, open: { ...team.open, oldest: team.open.oldest.map(j => ({ ...j, siteName: siteName(j.siteId) })) } },
  };
}

/** One person's page at the desk. */
export async function getDeskPersonInsights(key: string, params: ReportParams, now = new Date()) {
  const { ctx, desk, jobs, failed } = await deskData(params, now);
  const person = buildDeskPerson(desk, key, ctx.period, jobs);
  if (!person) return { ...ctx, session: undefined, failed, person: null };
  const sites = await sitesByIds(person.sites);
  return {
    ...ctx, session: undefined, failed,
    person: { ...person, sites: person.sites.map(id => (id ? sites.get(id)?.name ?? "Removed site" : "Not tied to a site")) },
    team: { onTime: desk.onTime, total: desk.total, people: desk.people.length },
  };
}

export type DeskInsights = Awaited<ReturnType<typeof getDeskInsights>>;
export type DeskPersonInsights = Awaited<ReturnType<typeof getDeskPersonInsights>>;
