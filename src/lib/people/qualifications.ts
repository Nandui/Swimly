import "server-only";
import { today } from "@/lib/format";
import { mayFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { qualificationState } from "@/lib/people/data";
import { requirementStates } from "@/lib/people/requirements";

/** One person's qualifications for their HR file (owner decision, 8 October 2026): what their
 *  position needs and whether they hold it in date, every record with its certificate, and
 *  whether this viewer may record or withdraw them. The caller has already checked it may read
 *  the person's file; recording still needs `qualifications.manage` over them, checked again on
 *  every write. */
export async function qualificationFile(userId: string, orgId: string) {
  const [person, records, types, canRecord] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, orgId }, select: { position: { select: { name: true, requires: { select: { type: { select: { id: true, name: true } } } } } } } }),
    prisma.qualification.findMany({
      where: { userId }, orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { expiresOn: { sort: "asc", nulls: "last" } }],
      select: { id: true, typeId: true, issuedOn: true, expiresOn: true, reference: true, revokedAt: true, verifiedById: true, type: { select: { name: true } } },
    }),
    prisma.qualificationType.findMany({ where: { orgId, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, validityMonths: true } }),
    mayFor("qualifications.manage", { subjectUserId: userId, orgId }),
  ]);
  const [evidence, verifiers] = await Promise.all([
    prisma.qualificationEvidence.findMany({ where: { qualificationId: { in: records.map((r) => r.id) } }, select: { id: true, qualificationId: true } }),
    prisma.user.findMany({ where: { id: { in: records.flatMap((r) => (r.verifiedById ? [r.verifiedById] : [])) } }, select: { id: true, name: true } }),
  ]);
  const certificate = new Map(evidence.map((e) => [e.qualificationId, e.id]));
  const verifier = new Map(verifiers.map((v) => [v.id, v.name]));
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  return {
    position: person?.position?.name ?? null,
    requirements: requirementStates(person?.position?.requires.map((r) => r.type) ?? [], records, today()),
    records: records.map((r) => ({
      id: r.id, name: r.type.name, issuedOn: iso(r.issuedOn), expiresOn: iso(r.expiresOn), reference: r.reference, state: qualificationState(r),
      verifiedBy: r.verifiedById ? verifier.get(r.verifiedById) ?? null : null, certificateId: certificate.get(r.id) ?? null,
    })),
    types, canRecord,
  };
}
