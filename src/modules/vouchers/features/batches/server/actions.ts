"use server";

import { randomInt } from "node:crypto";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { liveSitesOf, sitesByIds } from "@/lib/directory";
import { formatDate, isDateOnly, parseDateOnly, plural, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { coversAll } from "@/modules/vouchers/shared/reads";
import { MAX_BATCH, newCodes } from "@/modules/vouchers/shared/rules";
import { manager, NOT_MANAGER, OTHER_SITES, refresh, siteOf } from "@/modules/vouchers/shared/server";

/** Batch writes: making, changing and cancelling a batch needs `vouchers.manage` at every site
 *  the batch names. Every write is audited. */

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`).default("");

const batchSchema = z.object({
  occasion: z.string().trim().min(2, "Say what the vouchers are for, like Christmas 2026.").max(80),
  recipient: z.string().trim().min(2, "Say who the vouchers are given to.").max(120),
  contactName: text(100), contactDetail: text(200),
  service: z.string().trim().min(2, "Say what each voucher gives, like Family swim.").max(80),
  quantity: z.coerce.number().int("Give a whole number of vouchers.").min(1, "Make at least one voucher.").max(MAX_BATCH, `Up to ${MAX_BATCH} vouchers in one batch; make a second batch for more.`),
  validFrom: z.string().refine(isDateOnly, "Choose the first day the vouchers can be used."),
  validUntil: z.string().refine(isDateOnly, "Choose the last day the vouchers can be used."),
  siteIds: z.array(z.string().min(1)).min(1, "Choose at least one site that accepts them.").max(50),
  terms: text(400), note: text(1000),
});
export type BatchInput = z.input<typeof batchSchema>;

/** Make a batch with a code for every voucher, or change one. The number of vouchers never
 *  changes afterwards: the codes may already be printed. */
export async function saveBatch(id: string | null, input: BatchInput): Promise<ActionResult & { id?: string }> {
  const who = await manager();
  if (!who) return fail(NOT_MANAGER);
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { quantity, ...data } = parsed.data;
  if (data.validUntil < data.validFrom) return fail("The last day cannot be before the first day.");
  if (!id && data.validUntil < today()) return fail("The last day has already passed.");
  const siteIds = [...new Set(data.siteIds)];
  if (!coversAll(who.sites, siteIds)) return fail("Choose only sites your level covers.");
  const existing = id ? await prisma.voucherBatch.findFirst({ where: { id, orgId: who.orgId, voidedAt: null }, select: { siteIds: true } }) : null;
  if (id && !existing) return fail("That batch no longer exists, or was cancelled.");
  if (existing && !coversAll(who.sites, existing.siteIds)) return fail(OTHER_SITES);
  // Open sites of this organisation, or a site the batch already named (archived since).
  const open = new Set([...(await liveSitesOf(who.orgId)).map((s) => s.id), ...(existing?.siteIds ?? [])]);
  if (!siteIds.every((s) => open.has(s))) return fail("One of those sites is not open.");
  const sites = await sitesByIds(siteIds);
  const at = siteIds.flatMap((s) => sites.get(s)?.name ?? []).join(", ");
  const values = { ...data, siteIds, validFrom: parseDateOnly(data.validFrom), validUntil: parseDateOnly(data.validUntil) };
  const until = formatDate(values.validUntil);

  if (id) {
    await prisma.$transaction(async (tx) => {
      await tx.voucherBatch.update({ where: { id }, data: values });
      await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "VoucherBatch", entityId: id, clubId: siteOf(siteIds),
        summary: `Changed the ${data.service} vouchers for ${data.recipient} (${data.occasion}): valid until ${until} at ${at}` }, tx);
    });
    refresh(id);
    return { ok: true, id };
  }

  // Codes are drawn before the transaction; the unique index is the arbiter if two batches ever draw the same one.
  const drawn = newCodes(quantity, new Set(), randomInt);
  const clash = new Set((await prisma.voucher.findMany({ where: { code: { in: drawn } }, select: { code: true } })).map((v) => v.code));
  const codes = clash.size ? [...drawn.filter((c) => !clash.has(c)), ...newCodes(clash.size, new Set([...drawn, ...clash]), randomInt)] : drawn;
  const created = await prisma.$transaction(async (tx) => {
    const batch = await tx.voucherBatch.create({ data: { ...values, quantity, orgId: who.orgId, createdById: who.id, createdByName: who.name }, select: { id: true } });
    await tx.voucher.createMany({ data: codes.map((code, i) => ({ orgId: who.orgId, batchId: batch.id, number: i + 1, code })) });
    await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "VoucherBatch", entityId: batch.id, clubId: siteOf(siteIds),
      summary: `Made ${plural(quantity, `${data.service} voucher`)} for ${data.recipient} (${data.occasion}), valid until ${until} at ${at}` }, tx);
    return batch;
  });
  refresh(created.id);
  return { ok: true, id: created.id };
}

/** Cancel a batch: its unused vouchers stop working. Used ones stay in the record. */
export async function voidBatch(id: string, reason: string): Promise<ActionResult> {
  const who = await manager();
  if (!who) return fail(NOT_MANAGER);
  const why = reason.trim().slice(0, 300);
  if (why.length < 3) return fail("Say why the batch is cancelled.");
  const batch = await prisma.voucherBatch.findFirst({ where: { id, orgId: who.orgId }, select: { siteIds: true, voidedAt: true, recipient: true, service: true, occasion: true } });
  if (!batch) return fail("That batch no longer exists.");
  if (batch.voidedAt) return fail("That batch is already cancelled.");
  if (!coversAll(who.sites, batch.siteIds)) return fail(OTHER_SITES);
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.voucherBatch.updateMany({ where: { id, voidedAt: null }, data: { voidedAt: new Date(), voidedByName: who.name, voidReason: why } });
    if (claimed.count !== 1) return fail("Someone cancelled this batch just now.");
    const unused = await tx.voucher.count({ where: { batchId: id, redeemedAt: null, voidedAt: null } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "cancel", entity: "VoucherBatch", entityId: id, clubId: siteOf(batch.siteIds),
      summary: `Cancelled the ${batch.service} vouchers for ${batch.recipient} (${batch.occasion}), ${unused} unused: ${why}` }, tx);
    return ok();
  });
  if (result.ok) refresh(id);
  return result;
}
