import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { HELP_IMAGE_DIMENSIONS } from "@/lib/help/screenshots";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Route handlers do not inherit the help layout's authentication guard.
  const session = await auth();
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };
  if (!session?.user) return new Response(null, { status: 401, headers });
  const { id } = await params;
  if (!/^[a-z]+(?:-[a-z]+)*$/.test(id) || !Object.hasOwn(HELP_IMAGE_DIMENSIONS, id)) return new Response(null, { status: 404, headers });
  const bytes = await readFile(path.join(process.cwd(), "assets", "help", `${id}.png`));
  return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/png" } });
}
