import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { kind, id } = await params;
  if (kind !== "programme" && kind !== "level") return new Response(null, { status: 404 });
  const select = { imageData: true, imageVersion: true } as const;
  const row = kind === "programme"
    ? await prisma.programme.findUnique({ where: { id }, select })
    : await prisma.level.findUnique({ where: { id }, select });
  if (!row?.imageData || !row.imageVersion || new URL(request.url).searchParams.get("v") !== row.imageVersion) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const headers = {
    "Content-Type": "image/webp",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-cache",
    "Vary": "Cookie",
    "ETag": `"${row.imageVersion}"`,
  };
  if (request.headers.get("if-none-match") === headers.ETag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(row.imageData), { headers });
}
