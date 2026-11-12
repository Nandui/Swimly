"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { formatDate, isDateOnly, parseDateOnly, plural, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCapFor, sitesFor } from "@/lib/policy/session";
import { requireVouchersActor } from "@/lib/vouchers/access";
import { coversAll, validity } from "@/lib/vouchers/data";
import { MAX_BATCH, acceptedAt, newCodes, normaliseCode, voucherState } from "@/lib/vouchers/rules";

/** The Vouchers writes (docs/vouchers.md). Making, changing and cancelling
 *  batches needs `vouchers.manage` at every site the batch names; marking a
 *  voucher as used needs `vouchers.redeem` at the site it is used at. Every
 *  write is audited. */

function revalidate(batchId?: string) {
  revalidatePath("/vouchers");
  revalidatePath("/vouchers/batches");
  if (batchId) revalidatePath(`/vouchers/batches/${batchId}`);
}
async function manager() {
  const who = await requireVouchersActor();
  if (!who.manage || !who.orgId) return null;
  return { ...who, orgId: who.orgId, sites: await sitesFor("vouchers.manage") };
}
const NOT_MANAGER = "Giving out vouchers needs Vouchers: Manage.";
const OTHER_SITES = "This batch includes a site your role does not cover.";
const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`).default("");
/** A batch's audit entry belongs to its site when it has one, otherwise to none. */
const siteOf = (siteIds: readonly string[]) => (siteIds.length === 1 ? siteIds[0] : null);

/* Batches. */

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

/** Make a batch with a code for every voucher, or change one. The number of
 *  vouchers never changes afterwards: the codes may already be printed. */
export async function saveBatch(id: string | null, input: BatchInput): Promise<ActionResult & { id?: string }> {
  const who = await manager();
  if (!who) return fail(NOT_MANAGER);
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { quantity, ...data } = parsed.data;
  if (data.validUntil < data.validFrom) return fail("The last day cannot be before the first day.");
  if (!id && data.validUntil < today()) return fail("The last day has already passed.");
  const siteIds = [...new Set(data.siteIds)];
  if (!coversAll(who.sites, siteIds)) return fail("Choose only sites your role covers.");
  const clubs = await prisma.club.findMany({ where: { id: { in: siteIds }, orgId: who.orgId }, select: { id: true, name: true } });
  if (clubs.length !== siteIds.length) return fail("One of those sites no longer exists.");
  const values = { ...data, siteIds, validFrom: parseDateOnly(data.validFrom), validUntil: parseDateOnly(data.validUntil) };
  const until = formatDate(values.validUntil);

  if (id) {
    const existing = await prisma.voucherBatch.findFirst({ where: { id, orgId: who.orgId, voidedAt: null }, select: { siteIds: true } });
    if (!existing) return fail("That batch no longer exists, or was cancelled.");
    if (!coversAll(who.sites, existing.siteIds)) return fail(OTHER_SITES);
    await prisma.$transaction(async (tx) => {
      await tx.voucherBatch.update({ where: { id }, data: values });
      await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "VoucherBatch", entityId: id, clubId: siteOf(siteIds),
        summary: `Changed the ${data.service} vouchers for ${data.recipient} (${data.occasion}): valid until ${until} at ${clubs.map((c) => c.name).join(", ")}` }, tx);
    });
    revalidate(id);
    return { ...ok(), id };
  }

  // Codes are drawn before the transaction; the unique index is the arbiter if two batches ever draw the same one.
  const drawn = newCodes(quantity, new Set(), randomInt);
  const clash = new Set((await prisma.voucher.findMany({ where: { code: { in: drawn } }, select: { code: true } })).map((v) => v.code));
  const codes = clash.size ? [...drawn.filter((c) => !clash.has(c)), ...newCodes(clash.size, new Set([...drawn, ...clash]), randomInt)] : drawn;
  const created = await prisma.$transaction(async (tx) => {
    const batch = await tx.voucherBatch.create({ data: { ...values, quantity, orgId: who.orgId, createdById: who.id, createdByName: who.name }, select: { id: true } });
    await tx.voucher.createMany({ data: codes.map((code, i) => ({ batchId: batch.id, number: i + 1, code })) });
    await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "VoucherBatch", entityId: batch.id, clubId: siteOf(siteIds),
      summary: `Made ${plural(quantity, `${data.service} voucher`)} for ${data.recipient} (${data.occasion}), valid until ${until} at ${clubs.map((c) => c.name).join(", ")}` }, tx);
    return batch;
  });
  revalidate(created.id);
  return { ...ok(), id: created.id };
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
  if (result.ok) revalidate(id);
  return result;
}

/* One voucher. */

/** Mark a voucher as used at a site. The code must be valid today, accepted at
 *  that site and not used or cancelled; two desks at once cannot both use it. */
export async function redeemVoucher(codeInput: string, siteId: string): Promise<ActionResult> {
  const who = await requireVouchersActor();
  const code = normaliseCode(codeInput);
  if (!code) return fail("That is not a voucher code. Check each character.");
  try { await requireCapFor("vouchers.redeem", { siteId, orgId: who.orgId }); }
  catch (error) { if (error instanceof AuthorizationError) return fail("You can only use vouchers at the sites your role covers."); throw error; }
  const voucher = await prisma.voucher.findFirst({
    where: { code, batch: { orgId: who.orgId ?? undefined } },
    select: { id: true, batchId: true, redeemedAt: true, voidedAt: true, batch: { select: { service: true, recipient: true, siteIds: true, validFrom: true, validUntil: true, voidedAt: true } } },
  });
  if (!voucher) return fail(`No voucher has the code ${code}.`);
  const state = voucherState({ redeemed: voucher.redeemedAt !== null, voided: voucher.voidedAt !== null }, validity(voucher.batch), today());
  if (state === "used") return fail("This voucher has already been used.");
  if (state === "void") return fail("This voucher was cancelled and cannot be used.");
  if (state === "upcoming") return fail(`This voucher cannot be used until ${formatDate(voucher.batch.validFrom)}.`);
  if (state === "expired") return fail(`This voucher expired on ${formatDate(voucher.batch.validUntil)}.`);
  if (!acceptedAt(voucher.batch, siteId)) return fail("This voucher is not accepted at this site.");
  const result = await prisma.$transaction(async (tx) => {
    // Claim it first, so a second desk with the same code is told it was used.
    const claimed = await tx.voucher.updateMany({ where: { id: voucher.id, redeemedAt: null, voidedAt: null }, data: { redeemedAt: new Date(), redeemedSiteId: siteId, redeemedById: who.id, redeemedByName: who.name } });
    if (claimed.count !== 1) return fail("This voucher was used just now at another desk.");
    await logAudit({ actorId: who.id, actorName: who.name, action: "redeem", entity: "Voucher", entityId: voucher.id, clubId: siteId,
      summary: `Used voucher ${code}: ${voucher.batch.service}, given to ${voucher.batch.recipient}` }, tx);
    return ok();
  });
  if (result.ok) revalidate(voucher.batchId);
  return result;
}

/** Put right a voucher marked as used by mistake: it can be used again. */
export async function unredeemVoucher(id: string): Promise<ActionResult> {
  const who = await manager();
  if (!who) return fail(NOT_MANAGER);
  const voucher = await prisma.voucher.findFirst({ where: { id, batch: { orgId: who.orgId } }, select: { code: true, batchId: true, redeemedAt: true, redeemedSiteId: true, redeemedByName: true } });
  if (!voucher) return fail("That voucher no longer exists.");
  if (!voucher.redeemedAt || !voucher.redeemedSiteId) return fail("That voucher is not marked as used.");
  if (!coversAll(who.sites, [voucher.redeemedSiteId])) return fail("It was used at a site your role does not cover.");
  const siteId = voucher.redeemedSiteId;
  const result = await prisma.$transaction(async (tx) => {
    const undone = await tx.voucher.updateMany({ where: { id, redeemedAt: { not: null } }, data: { redeemedAt: null, redeemedSiteId: null, redeemedById: null, redeemedByName: null } });
    if (undone.count !== 1) return fail("Someone changed this voucher just now.");
    await logAudit({ actorId: who.id, actorName: who.name, action: "restore", entity: "Voucher", entityId: id, clubId: siteId,
      summary: `Marked voucher ${voucher.code} as not used (it was marked used by ${voucher.redeemedByName})` }, tx);
    return ok();
  });
  if (result.ok) revalidate(voucher.batchId);
  return result;
}

/** Cancel one unused voucher, for example one reported lost. */
export async function voidVoucher(id: string): Promise<ActionResult> {
  const who = await manager();
  if (!who) return fail(NOT_MANAGER);
  const voucher = await prisma.voucher.findFirst({ where: { id, batch: { orgId: who.orgId } }, select: { code: true, batchId: true, redeemedAt: true, voidedAt: true, batch: { select: { siteIds: true, recipient: true } } } });
  if (!voucher) return fail("That voucher no longer exists.");
  if (voucher.redeemedAt) return fail("A used voucher cannot be cancelled.");
  if (voucher.voidedAt) return fail("That voucher is already cancelled.");
  if (!coversAll(who.sites, voucher.batch.siteIds)) return fail(OTHER_SITES);
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.voucher.updateMany({ where: { id, redeemedAt: null, voidedAt: null }, data: { voidedAt: new Date(), voidedByName: who.name } });
    if (claimed.count !== 1) return fail("Someone used or cancelled this voucher just now.");
    await logAudit({ actorId: who.id, actorName: who.name, action: "cancel", entity: "Voucher", entityId: id, clubId: siteOf(voucher.batch.siteIds),
      summary: `Cancelled voucher ${voucher.code}, given to ${voucher.batch.recipient}` }, tx);
    return ok();
  });
  if (result.ok) revalidate(voucher.batchId);
  return result;
}
