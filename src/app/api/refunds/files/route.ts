import { revalidatePath } from "next/cache";
import { requireRefundActor } from "@/lib/refunds/auth";
import { changeReceipt, MAX_RECEIPT_BYTES } from "@/lib/refunds/files";
import { RefundError } from "@/lib/refunds/rules";

export async function POST(request: Request) {
  try {
    const who = await requireRefundActor();
    const origin = request.headers.get('origin'), host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (!origin || new URL(origin).host !== host) return Response.json({ ok: false, error: 'Submit receipts from the staff app.' }, { status: 403 });
    const reader = request.body?.getReader();
    if (!reader) throw new RefundError('Choose a receipt.');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_RECEIPT_BYTES + 128 * 1024) { await reader.cancel(); return Response.json({ ok: false, error: 'Receipts must be no larger than 4 MB.' }, { status: 413 }); } chunks.push(value); }
    const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
    const file = form.get('file');
    if (file !== null && !(file instanceof File)) throw new RefundError('Choose a valid receipt.');
    const row = await changeReceipt(who, { id: String(form.get('id')), operationId: String(form.get('operationId')), version: Number(form.get('version')), attachmentId: String(form.get('attachmentId')) }, file || undefined);
    revalidatePath('/refunds', 'layout');
    return Response.json({ ok: true, id: row.id, version: row.version });
  } catch (error) { return Response.json({ ok: false, error: error instanceof RefundError ? error.message : 'Could not confirm the receipt update. Try again.' }, { status: 400 }); }
}
