import { AuthorizationError } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";

/** An uploaded certificate, for someone whose qualifications role covers the
 *  person. Served inline, never cached, with the stored type only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.qualificationEvidence.findUnique({ where: { id }, select: { userId: true, orgId: true, fileName: true, mime: true, bytes: true } });
  if (!row) return new Response("Not found", { status: 404 });
  try {
    await requireCapFor("qualifications.manage", { subjectUserId: row.userId, orgId: row.orgId });
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response("Not found", { status: 404 });
    throw error;
  }
  const name = row.fileName.replace(/[^A-Za-z0-9._-]+/g, "-");
  return new Response(new Uint8Array(row.bytes), { headers: {
    "Content-Type": row.mime, "Content-Disposition": `inline; filename="${name}"`, "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  } });
}
