import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { activeStaffAtSite, areaNamesAt, liveSitesOf, withSite, withSites } from "@/lib/directory";
import { today } from "@/lib/format";
import { requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession, sitesFor } from "@/lib/policy/session";
import { covers, inSites, requireIncidentsActor } from "@/modules/incidents/shared/access";
import { needsParent, needsRootCause, needsSignoff } from "@/modules/incidents/shared/rules";
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
  const mine = await prisma.incidentAction.findMany({ where: { ownerId: who.id, status: "open" }, select: { dueOn: true } });
  const yours = { yourActions: mine.length, yourOverdue: mine.filter((a) => a.dueOn < today()).length };
  if (!who.review) return { toTriage: 0, toSignOff: 0, investigating: 0, overdueActions: 0, signoff: false, ...yours };
  const [reviewSites, signoffSites] = await Promise.all([sitesFor("incidents.reports.review"), who.signoff ? sitesFor("incidents.reports.signoff") : null]);
  const org = { orgId: who.orgId ?? undefined };
  const [toTriage, open] = await Promise.all([
    prisma.incidentReport.count({ where: { ...org, ...inSites(reviewSites), status: "reported", OR: [{ reporterId: { not: who.id } }, ...(signoffSites ? [inSites(signoffSites)] : [])] } }),
    prisma.incidentReport.findMany({ where: { ...org, ...inSites(reviewSites), status: "investigating", reporterId: { not: who.id } }, select: { siteId: true, serious: true, severityActual: true, severityPotential: true } }),
  ]);
  const toSignOff = signoffSites ? open.filter((r) => needsSignoff(r) && covers(signoffSites, r.siteId)).length : 0;
  const overdueActions = await prisma.incidentAction.count({ where: { status: "open", dueOn: { lt: today() }, report: { ...org, ...inSites(reviewSites), reporterId: { not: who.id } } } });
  return { toTriage, toSignOff, investigating: open.length, overdueActions, signoff: who.signoff, ...yours };
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
      statements: { orderBy: { createdAt: "asc" } },
      actions: { orderBy: [{ createdAt: "asc" }] },
      files: { where: { removedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, mime: true, size: true, addedById: true, addedByName: true, createdAt: true } },
    },
  });
  if (!found) notFound();
  const rights = await reportRights(found, who);
  if (!rights.read) notFound();
  if (!rights.own && found.people.length) await prisma.incidentAccessEvent.create({ data: { reportId: id, actorId: who.id, actorName: who.name } });
  const reads = rights.signoff ? await prisma.incidentAccessEvent.findMany({ where: { reportId: id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, actorName: true, createdAt: true } }) : [];
  // The investigation is for those who triage at the site; a reporter sees
  // the outcome, not the statements or the working.
  const investigation = rights.review
    ? { statements: found.statements, actions: found.actions, whys: found.whys, rootCause: found.rootCause }
    : { statements: [], actions: [], whys: [], rootCause: "" };
  const report = await withSite({ ...found, ...investigation }, "siteId", "site");
  const status = report.status as IncidentStatus;
  const investigate = status === "investigating" && rights.review && !rights.own;
  return {
    who, report: { ...report, status }, reads, today: today(),
    /** What the triage asks depends on who is named (triage-guides.ts). */
    triage: {
      injured: report.people.some((p) => p.injured),
      hasStaff: report.people.some((p) => p.type === "staff"),
      needsParent: needsParent({ category: report.category, hasChild: report.people.some((p) => p.ageGroup === "child") }),
    },
    can: {
      triage: status === "reported" && rights.review && (!rights.own || rights.signoff),
      close: investigate && (!needsSignoff(report) || rights.signoff),
      investigate,
      reopen: status === "closed" && rights.signoff && !rights.own,
      export: rights.signoff && !rights.own,
      addFiles: status !== "closed" && (rights.own || rights.review),
      removeFiles: status !== "closed" && rights.review,
      seeInvestigation: rights.review,
      seeAlerts: rights.review,
    },
    owners: investigate ? await activeStaffAtSite(who.orgId, report.siteId) : [],
    openActions: report.actions.filter((a) => a.status === "open").length,
    needsSignoff: needsSignoff(report),
    needsRootCause: needsRootCause(report),
  };
}
export type IncidentDetail = Awaited<ReturnType<typeof incidentReport>>;

/** What the report form offers: the sites this person may report at, each
 *  one's areas and team (to name a staff member who was hurt), and whether
 *  they can open the site's emergency plans in Docs (a link, never an import). */
export async function reportFormData() {
  const who = await requireIncidentsActor();
  const [sites, all] = await Promise.all([sitesFor("incidents.reports.create"), liveSitesOf(who.orgId)]);
  const open = all.filter((s) => covers(sites, s.id));
  const [areas, staff] = await Promise.all([
    Promise.all(open.map(async (s) => [s.id, await areaNamesAt(s.id)] as const)).then(Object.fromEntries),
    Promise.all(open.map(async (s) => [s.id, (await activeStaffAtSite(who.orgId, s.id)).map(({ id, name }) => ({ id, name }))] as const)).then(Object.fromEntries),
  ]);
  const docs = holdsAnywhere(actorForSession(await requireSession()), "docs.read");
  return { sites: open.map(({ id, name }) => ({ id, name })), areas: areas as Record<string, string[]>, staff: staff as Record<string, { id: string; name: string }[]>, docs };
}

