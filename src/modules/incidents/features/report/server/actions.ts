"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authz";
import { activeStaffAtSite, liveSiteById } from "@/lib/directory";
import { requireCapFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { requireIncidentsActor } from "@/modules/incidents/shared/access";
import { requestOrigin } from "@/modules/incidents/shared/origin";
import { addendumSchema, isSerious, reportProblem, reportSchema, type ReportInput } from "@/modules/incidents/shared/rules";
import { lockReport, recordEvent, reportRights } from "@/modules/incidents/shared/service";
import { deliverAlerts, queueAlerts } from "@/modules/incidents/features/report/server/alerts";

/** Reporting (docs/incidents.md). Anyone with `incidents.reports.create` at
 *  the site reports; submitting locks their words, and a serious report alerts
 *  the managers straight after it is saved. Every write is audited. */

export async function submitReport(input: ReportInput): Promise<ActionResult & { id?: string }> {
  const who = await requireIncidentsActor();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const r = parsed.data;
  const problem = reportProblem(r);
  if (problem) return fail(problem);
  try { await requireCapFor("incidents.reports.create", { siteId: r.siteId, orgId: who.orgId }); }
  catch (error) { if (error instanceof AuthorizationError) return fail("You can only report incidents at the sites your role covers."); throw error; }
  const site = await liveSiteById(r.siteId);
  if (!site) return fail("Choose an open site.");
  const serious = isSerious(r);
  // A staff member is linked only when they are one of this site's team, so
  // their injury reaches their HR file and nobody else's.
  const team = r.people.some((p) => p.type === "staff" && p.userId) ? new Set((await activeStaffAtSite(who.orgId, r.siteId)).map((s) => s.id)) : new Set<string>();
  const people = r.people.map(({ userId, ...p }) => ({
    ...(p.injured ? p : { ...p, bodyPart: "", injury: "", firstAid: "", firstAidBy: "", ambulance: false, hospital: false }),
    userId: p.type === "staff" && team.has(userId) ? userId : null,
  }));
  const report = await prisma.$transaction(async (tx) => {
    const row = await tx.incidentReport.create({
      data: {
        orgId: who.orgId, siteId: r.siteId, area: r.area, kind: r.kind, category: r.category,
        occurredOn: r.occurredOn, occurredAt: r.occurredAt, description: r.description, immediateAction: r.immediateAction, raisedBy: r.raisedBy,
        serious, reporterId: who.id, reporterName: who.name,
        people: { create: people },
        witnesses: { create: r.witnesses },
      },
    });
    await recordEvent(tx, row, who, "submit");
    if (serious) await queueAlerts(tx, row);
    return row;
  });
  if (serious) await deliverAlerts(report.id, await requestOrigin());
  revalidatePath("/incidents", "layout");
  return { ...ok(), id: report.id };
}

/** A later correction or fact, added beside the locked report with a name and time. */
export async function addAddendum(id: string, note: string): Promise<ActionResult> {
  const who = await requireIncidentsActor();
  const parsed = addendumSchema.safeParse({ note });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const row = await prisma.incidentReport.findFirst({ where: { id, orgId: who.orgId ?? undefined } });
  if (!row || !(await reportRights(row, who)).read) return fail("This report is not available.");
  await prisma.$transaction(async (tx) => {
    await lockReport(tx, id);
    await recordEvent(tx, row, who, "addendum", parsed.data.note);
    await tx.incidentReport.update({ where: { id }, data: { version: { increment: 1 } } });
  });
  revalidatePath(`/incidents/${id}`);
  return ok();
}
