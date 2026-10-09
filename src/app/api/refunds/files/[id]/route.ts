import { readReceipt, requireRefundActor } from "@/modules/refunds/features/request";

export async function GET(_request: Request, { params }: RouteContext<"/api/refunds/files/[id]">) {
  try {
    const who = await requireRefundActor(), { id } = await params;
    const file = await readReceipt(who, id);
    return new Response(new Uint8Array(file.bytes), { headers: { 'Content-Type': file.mime, 'Content-Length': String(file.size), 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
  } catch { return new Response('Receipt not available.', { status: 404, headers: { 'Cache-Control': 'no-store' } }); }
}
