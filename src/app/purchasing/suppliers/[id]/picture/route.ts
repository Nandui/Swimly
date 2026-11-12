import { supplierPicture } from "@/modules/purchasing/features/suppliers";

export const runtime = "nodejs";

/** A supplier's picture, for anyone who may open Purchasing. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const picture = await supplierPicture((await params).id, new URL(request.url).searchParams.get("v"));
  if (!picture) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const headers = {
    "Content-Type": "image/webp",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-cache",
    "Vary": "Cookie",
    "ETag": `"${picture.version}"`,
  };
  if (request.headers.get("if-none-match") === headers.ETag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(picture.bytes), { headers });
}
