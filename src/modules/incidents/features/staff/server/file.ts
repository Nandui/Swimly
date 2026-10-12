import "server-only";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import type { PersonFileEntry } from "@/modules/contributions";
import { incidentCategories, incidentKinds, incidentNumber, type IncidentCategory, type IncidentKind } from "@/modules/incidents/shared/types";

/** What Incidents holds about one staff member, for HR (docs/incidents.md,
 *  "HR"). Only reports where the reporter picked them from the site's team are
 *  linked. HR has already checked `hr.records.read` over the person and logged
 *  the read; these return records, never permissions. */

const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));

/** Their personal file: each incident they were involved in, with any injury
 *  and treatment, newest first. */
export async function staffIncidentFile(userId: string, orgId: string): Promise<{ summary: string; entries: PersonFileEntry[] }> {
  const rows = await prisma.incidentPerson.findMany({
    where: { userId, report: { orgId } },
    orderBy: { report: { occurredOn: "desc" } },
    select: {
      id: true, injured: true, injury: true, bodyPart: true, firstAid: true, ambulance: true, hospital: true,
      report: { select: { number: true, kind: true, category: true, occurredOn: true, hsaReportable: true } },
    },
  });
  const injured = rows.filter((p) => p.injured).length;
  const entries = rows.map((p): PersonFileEntry => {
    const r = p.report;
    const what = `${incidentKinds[r.kind as IncidentKind]?.label ?? "Incident"}: ${incidentCategories[r.category as IncidentCategory]?.label.toLowerCase() ?? "other"}`;
    const hurt = p.injured
      ? [[p.injury, p.bodyPart].filter(Boolean).join(", ") || "Hurt or ill", p.firstAid ? "first aid given" : null, p.ambulance ? "ambulance called" : null, p.hospital ? "went to hospital or a doctor" : null].filter(Boolean).join("; ")
      : "Not hurt";
    return { id: p.id, on: r.occurredOn, title: `${what}, ${day(r.occurredOn)}`, detail: `${hurt}. ${incidentNumber(r.number)}${r.hsaReportable ? ", reported to the HSA" : ""}.` };
  });
  return { summary: rows.length ? `${rows.length} incident${rows.length === 1 ? "" : "s"}, hurt in ${injured}` : "None", entries };
}

/** For a subject access request: the reports they filed, and their own part in
 *  any report they were named in (never the other people on it). */
export async function staffIncidentRecords(userId: string, orgId: string) {
  const [filed, involved] = await Promise.all([
    prisma.incidentReport.findMany({
      where: { orgId, reporterId: userId },
      orderBy: { createdAt: "asc" },
      select: { number: true, kind: true, category: true, occurredOn: true, occurredAt: true, area: true, description: true, immediateAction: true, raisedBy: true, status: true, closeNote: true, createdAt: true },
    }),
    prisma.incidentPerson.findMany({
      where: { userId, report: { orgId } },
      orderBy: { createdAt: "asc" },
      select: {
        type: true, ageGroup: true, name: true, contact: true, injured: true, bodyPart: true, injury: true, firstAid: true, firstAidBy: true, ambulance: true, hospital: true,
        report: { select: { number: true, kind: true, category: true, occurredOn: true, occurredAt: true, area: true, description: true } },
      },
    }),
  ]);
  return {
    filed: filed.map((r) => ({ ...r, number: incidentNumber(r.number) })),
    involved: involved.map(({ report, ...p }) => ({ ...p, report: { ...report, number: incidentNumber(report.number) } })),
  };
}
