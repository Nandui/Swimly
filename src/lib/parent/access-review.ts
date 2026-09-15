import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { accessRequestDto, requestPage } from "@/lib/parent/access-requests";
import { idSchema, parseInput, readBody, reasonSchema } from "@/lib/parent/http";
import { lockParent } from "@/lib/parent/security";
import { ParentApiError, notFound } from "@/lib/parent/errors";

export async function listAccessReviews(request: Request) {
  const page = requestPage(request);
  const status = parseInput(z.enum(["PENDING", "APPROVED", "DECLINED"]), new URL(request.url).searchParams.get("status") ?? "PENDING");
  const where = { status };
  const [rows, total, pendingCount] = await prisma.$transaction([
    prisma.parentAccessRequest.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: (page - 1) * 20, take: 20,
      include: { parent: { select: { id: true, name: true, email: true, phone: true, isActive: true } }, student: { select: { id: true, firstName: true, lastName: true } } } }),
    prisma.parentAccessRequest.count({ where }), prisma.parentAccessRequest.count({ where: { status: "PENDING" } }),
  ]);
  return { items: rows.map(row => ({ ...accessRequestDto(row), parent: row.parent, student: row.student, reviewedByName: row.reviewedByName })), page, total, pendingCount };
}
export async function reviewAccessRequest(request: Request, requestId: string, attribution: { actorId: string; actorName: string; clubId: null }) {
  const id = parseInput(idSchema, requestId);
  const input = await readBody(request, z.discriminatedUnion("decision", [
    z.object({ decision: z.literal("APPROVED"), studentId: idSchema, reason: reasonSchema, reply: reasonSchema }).strict(),
    z.object({ decision: z.literal("DECLINED"), reason: reasonSchema, reply: reasonSchema }).strict(),
  ]));
  const candidate = await prisma.parentAccessRequest.findUnique({ where: { id }, select: { parent: { select: { email: true } } } });
  if (!candidate) notFound();
  return prisma.$transaction(async tx => {
    // Same lock order as session validation, manual grants and suspension.
    await lockParent(tx, candidate.parent.email);
    await tx.$queryRaw`SELECT id FROM "ParentAccessRequest" WHERE id=${id} FOR UPDATE`;
    const row = await tx.parentAccessRequest.findUniqueOrThrow({ where: { id }, include: { parent: true } });
    if (row.status !== "PENDING") throw new ParentApiError(409, "ALREADY_REVIEWED", "This request has already been reviewed. Refresh to see the decision.");
    if (input.decision === "APPROVED") {
      if (!row.parent.isActive) throw new ParentApiError(409, "ACCOUNT_SUSPENDED", "This parent account is suspended. Review the account before granting access.");
      const student = await tx.student.findUnique({ where: { id: input.studentId }, select: { id: true } });
      if (!student) notFound();
      const previous = await tx.parentChildAccess.findUnique({ where: { parentEmail_studentId: { parentEmail: row.parent.email, studentId: student.id } } });
      const access = await tx.parentChildAccess.upsert({ where: { parentEmail_studentId: { parentEmail: row.parent.email, studentId: student.id } },
        create: { parentEmail: row.parent.email, studentId: student.id, source: "STAFF_REQUEST_APPROVAL", grantedById: attribution.actorId },
        update: { revokedAt: null, source: "STAFF_REQUEST_APPROVAL", grantedById: attribution.actorId } });
      await logAudit({ ...attribution, entity: "ParentChildAccess", entityId: access.id, action: "grant", summary: `Approved parent access request: ${input.reason}`,
        details: { requestId: id, studentId: student.id, email: row.parent.email, reason: input.reason, previouslyRevoked: previous?.revokedAt?.toISOString() ?? null } }, tx);
    }
    const updated = await tx.parentAccessRequest.update({ where: { id }, data: { status: input.decision,
      studentId: input.decision === "APPROVED" ? input.studentId : null,
      reviewedById: attribution.actorId, reviewedByName: attribution.actorName, reviewedAt: new Date(), reply: input.reply } });
    await logAudit({ ...attribution, entity: "ParentAccessRequest", entityId: id, action: input.decision === "APPROVED" ? "approve" : "decline",
      summary: `Reviewed parent access request: ${input.reason}`, details: { reason: input.reason, parentId: row.parentId, before: row.status, after: updated.status, reply: updated.reply, studentId: updated.studentId } }, tx);
    return accessRequestDto(updated);
  });
}
