import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { withSite } from "@/lib/directory";
import { requireIncidentsActor } from "@/modules/incidents/shared/access";
import { recordEvent, reportRights } from "@/modules/incidents/shared/service";

/** One report in full, for the insurer or a solicitor (the
 *  export): everything on it, investigation included, with the file names
 *  and CCTV video names but not the files. Manage at the report's site only, never your own, and
 *  every opening goes in the report's history and the audit log. */
export async function incidentExport(id: string) {
  const who = await requireIncidentsActor();
  const found = await prisma.incidentReport.findFirst({
    where: { id, orgId: who.orgId ?? undefined },
    include: {
      people: { orderBy: { createdAt: "asc" } },
      witnesses: { orderBy: { createdAt: "asc" } },
      statements: { orderBy: { createdAt: "asc" } },
      actions: { orderBy: { createdAt: "asc" } },
      files: { where: { removedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, size: true, addedByName: true, createdAt: true } },
      footage: { where: { removedAt: null, receivedAt: { not: null } }, orderBy: { receivedAt: "asc" }, select: { id: true, name: true, size: true, uploadedBy: true, receivedAt: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!found) notFound();
  const rights = await reportRights(found, who);
  if (!rights.signoff || rights.own) notFound();
  await prisma.$transaction((tx) => recordEvent(tx, found, who, "export"));
  return { report: await withSite(found, "siteId", "site"), exportedBy: who.name, exportedAt: new Date() };
}
export type IncidentExport = Awaited<ReturnType<typeof incidentExport>>;
