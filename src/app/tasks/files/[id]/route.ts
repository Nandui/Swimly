import { AuthorizationError } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";

/** A photo or file given as a task's answer, for someone who does tasks at its site.
 *  Served inline, never cached, with the stored type only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.taskFile.findUnique({ where: { id }, select: { fileName: true, mime: true, bytes: true, task: { select: { siteId: true, orgId: true } } } });
  if (!row) return new Response("Not found", { status: 404 });
  try {
    await requireCapFor("tasks.complete", { siteId: row.task.siteId, orgId: row.task.orgId });
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
