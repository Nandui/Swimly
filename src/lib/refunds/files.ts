import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardRead, guardVersion, lockRefund, recordEvent, receiptSelect } from "@/lib/refunds/service";
import { editableRefund, type RefundActor } from "@/lib/refunds/types";
import { RefundError } from "@/lib/refunds/rules";

export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
export function validateReceipt(file: { name: string; type: string; size: number }, bytes: Buffer) {
  const formats = {
    "application/pdf": { extension: /\.pdf$/i, valid: bytes.subarray(0, 5).toString() === "%PDF-" },
    "image/jpeg": { extension: /\.jpe?g$/i, valid: bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 },
    "image/png": { extension: /\.png$/i, valid: bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
    "image/webp": { extension: /\.webp$/i, valid: bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP" },
  };
  const format = formats[file.type as keyof typeof formats];
  if (!format || !format.valid || !format.extension.test(file.name) || file.size !== bytes.length || !bytes.length || bytes.length > MAX_RECEIPT_BYTES)
    throw new RefundError("Use a valid PDF, JPEG, PNG or WebP receipt up to 4 MB.");
}
const fileCommand = z.object({ id: z.string().uuid(), operationId: z.string().uuid(), version: z.number().int().positive(), attachmentId: z.string().uuid() });
export async function changeReceipt(who: RefundActor, input: z.infer<typeof fileCommand>, file?: File) {
  if (!who.request) throw new RefundError("Refund request permission is required.");
  const parsed = fileCommand.safeParse(input);
  if (!parsed.success) throw new RefundError("Invalid receipt request. Refresh the page.");
  const { id, operationId, version, attachmentId } = parsed.data;
  if (file && file.size > MAX_RECEIPT_BYTES) throw new RefundError("Receipts must be no larger than 4 MB.");
  const bytes = file ? Buffer.from(await file.arrayBuffer()) : null;
  if (file && bytes) validateReceipt(file, bytes);
  return prisma.$transaction(async tx => {
    await lockRefund(tx, id);
    const row = await tx.refundRequest.findUnique({ where: { id } });
    guardRead(row, who);
    const action = file ? "upload" : "remove";
    const replay = await tx.refundEvent.findUnique({ where: { requestId_operationId: { requestId: id, operationId } } });
    if (replay) {
      if (replay.actorId !== who.id || replay.action !== action) throw new RefundError("This action reference has already been used.");
      return row;
    }
    guardVersion(row, version);
    if (!editableRefund(row, who)) throw new RefundError("Receipts can only change on your draft or a request returned for information.");
    let note: string;
    if (file && bytes) {
      if (await tx.refundAttachment.count({ where: { requestId: id, removedAt: null } }) >= 5) throw new RefundError("A request can have up to five receipts.");
      note = file.name.replace(/[\x00-\x1f\/\\]/g, "_").slice(0, 200);
      await tx.refundAttachment.create({ data: { id: attachmentId, requestId: id, name: note, mime: file.type, size: bytes.length, bytes, createdById: who.id } });
    } else {
      const receipt = await tx.refundAttachment.findFirst({ where: { id: attachmentId, requestId: id, removedAt: null }, select: receiptSelect });
      if (!receipt) throw new RefundError("This receipt is no longer available.");
      note = receipt.name;
      await tx.refundAttachment.update({ where: { id: attachmentId }, data: { removedAt: new Date() } });
    }
    const changed = await tx.refundRequest.update({ where: { id }, data: { version: { increment: 1 } } });
    await recordEvent(tx, changed, who, action, operationId, note);
    return changed;
  });
}
export async function readReceipt(who: RefundActor, id: string) {
  const file = await prisma.refundAttachment.findUnique({ where: { id }, include: { request: true } });
  guardRead(file?.request ?? null, who);
  if (!file) throw new RefundError("This receipt is not available.");
  return file;
}
