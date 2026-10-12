import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { areaNamesAt, liveSitesOf, withSite, withSites } from "@/lib/directory";
import { sitesFor } from "@/lib/policy/session";
import { covers, inSites, requireIncidentsActor } from "@/modules/incidents/shared/access";
import { needsSignoff } from "@/modules/incidents/shared/rules";
import { reportRights } from "@/modules/incidents/shared/service";
import type { IncidentStatus } from "@/modules/incidents/shared/types";

/** Incidents' reads (docs/incidents.md). Your own reports are always yours to
 *  see; everyone else's need triage access at the report's site. */

const ROW = {
  id: true, number: true, siteId: true, area: true, kind: true, category: true, occurredOn: true, occurredAt: true,
  status: true, serious: true, reporterId: true, reporterName: true, severityActual: true, severityPotential: true,
  hsaReportable: true, hsaDueOn: true, createdAt: true,
} as const;

/** The reports page: what waits for triage, what is being investigated, the
 *  person's own, and the latest closed at their sites. */
export async function incidentLists() {
  const who = await requireIncidentsActor();
  const sites = who.review ? await sitesFor("incidents.reports.review") : null;
  const org = { orgId: who.orgId ?? undefined };
  const theirs = sites ? { ...org, ...inSites(sites) } : null;
  const [toTriage, investigating, mine, closed] = await Promise.all([
    theirs ? prisma.incidentReport.findMany({ where: { ...theirs, status: "reported" }, orderBy: { createdAt: "asc" }, select: ROW }) : [],
    theirs ? prisma.incidentReport.findMany({ where: { ...theirs, status: "investigating" }, orderBy: { createdAt: "asc" }, select: ROW }) : [],
    prisma.incidentReport.findMany({ where: { ...org, reporterId: who.id }, orderBy: { createdAt: "desc" }, take: 20, select: ROW }),
    theirs ? prisma.incidentReport.findMany({ where: { ...theirs, status: "closed" }, orderBy: { closedAt: "desc" }, take: 20, select: ROW }) : [],
  ]);
  const named = async <T extends { siteId: string }>(rows: T[]) => withSites(rows, "siteId", "site");
  return { who, toTriage: await named(toTriage), investigating: await named(investigating), mine: await named(mine), closed: await named(closed) };
}
export type IncidentRow = Awaited<ReturnType<typeof incidentLists>>["mine"][number];

/** Counts for the starter page and Home: only what this person may open. */
export async function incidentCounts() {
  const who = await requireIncidentsActor();
  if (!who.review) return { toTriage: 0, toSignOff: 0, investigating: 0, signoff: false };
  const [reviewSites, signoffSites] = await Promise.all([sitesFor("incidents.reports.review"), who.signoff ? sitesFor("incidents.reports.signoff") : null]);
  const org = { orgId: who.orgId ?? undefined };
  const [toTriage, open] = await Promise.all([
    prisma.incidentReport.count({ where: { ...org, ...inSites(reviewSites), status: "reported", reporterId: { not: who.id } } }),
    prisma.incidentReport.findMany({ where: { ...org, ...inSites(reviewSites), status: "investigating", reporterId: { not: who.id } }, select: { siteId: true, serious: true, severityActual: true, severityPotential: true } }),
  ]);
  const toSignOff = signoffSites ? open.filter((r) => needsSignoff(r) && covers(signoffSites, r.siteId)).length : 0;
  return { toTriage, toSignOff, investigating: open.length, signoff: who.signoff };
}

/** One report, with what this person may do to it. A 404 when they may not see
 *  it. Opening someone else's report with people in it is logged. */
export async function incidentReport(id: string) {
  const who = await requireIncidentsActor();
  const found = await prisma.incidentReport.findFirst({
    where: { id, orgId: who.orgId ?? undefined },
    include: {
      people: { orderBy: { createdAt: "asc" } },
      witnesses: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      notifications: { select: { id: true, status: true, error: true } },
    },
  });
  if (!found) notFound();
  const rights = await reportRights(found, who);
  if (!rights.read) notFound();
  if (!rights.own && found.people.length) await prisma.incidentAccessEvent.create({ data: { reportId: id, actorId: who.id, actorName: who.name } });
  const reads = rights.signoff ? await prisma.incidentAccessEvent.findMany({ where: { reportId: id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, actorName: true, createdAt: true } }) : [];
  const report = await withSite(found, "siteId", "site");
  const status = report.status as IncidentStatus;
  return {
    who, report: { ...report, status }, reads,
    hasChild: report.people.some((p) => p.ageGroup === "child"),
    can: {
      triage: status === "reported" && rights.review && !rights.own,
      close: status === "investigating" && rights.review && !rights.own && (!needsSignoff(report) || rights.signoff),
      seeAlerts: rights.review,
    },
    needsSignoff: needsSignoff(report),
  };
}
export type IncidentDetail = Awaited<ReturnType<typeof incidentReport>>;

/** What the report form offers: the sites this person may report at and each one's areas. */
export async function reportFormData() {
  const who = await requireIncidentsActor();
  const [sites, all] = await Promise.all([sitesFor("incidents.reports.create"), liveSitesOf(who.orgId)]);
  const open = all.filter((s) => covers(sites, s.id));
  const areas = Object.fromEntries(await Promise.all(open.map(async (s) => [s.id, await areaNamesAt(s.id)] as const)));
  return { sites: open.map(({ id, name }) => ({ id, name })), areas };
}
