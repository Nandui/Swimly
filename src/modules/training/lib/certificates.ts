import "server-only";
import { prisma } from "@/lib/prisma";
import { subjectsFor } from "@/lib/policy/session";
import { requireTrainingActor } from "@/modules/training/lib/access";

/** Certificates staff uploaded in Turnfin Me, waiting to be checked, for the
 *  people the reader's `qualifications.manage` covers. Never their own. */
export async function certificateQueue(view: "PENDING" | "DONE" = "PENDING") {
  const who = await requireTrainingActor();
  if (!who.qualifications) return { who, rows: [], types: [] };
  const scope = await subjectsFor("qualifications.manage");
  const rows = await prisma.qualificationEvidence.findMany({
    where: {
      orgId: who.orgId ?? undefined,
      userId: { ...(scope.kind === "all" ? {} : { in: [...scope.userIds] }), not: who.id },
      ...(view === "PENDING" ? { status: "PENDING" } : { status: { in: ["VERIFIED", "DECLINED"] } }),
    },
    orderBy: view === "PENDING" ? { createdAt: "asc" } : { reviewedAt: "desc" },
    take: 50,
    select: { id: true, userId: true, typeId: true, typeName: true, issuedOn: true, expiresOn: true, reference: true, fileName: true, mime: true, size: true, status: true, reviewNote: true, reviewedByName: true, reviewedAt: true, createdAt: true },
  });
  const [people, types] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { id: true, name: true, jobTitle: true } }),
    prisma.qualificationType.findMany({ where: { orgId: who.orgId ?? undefined, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, validityMonths: true } }),
  ]);
  const byId = new Map(people.map((p) => [p.id, p]));
  return { who, types, rows: rows.flatMap((r) => (byId.has(r.userId) ? [{ ...r, person: byId.get(r.userId)! }] : [])) };
}
export type CertificateRow = Awaited<ReturnType<typeof certificateQueue>>["rows"][number];
