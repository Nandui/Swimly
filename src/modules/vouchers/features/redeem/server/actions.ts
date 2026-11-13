"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { liveSiteById } from "@/lib/directory";
import { formatDate, today } from "@/lib/format";
import { mayFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { requireVouchersActor } from "@/modules/vouchers/shared/access";
import { coversAll, validity } from "@/modules/vouchers/shared/reads";
import { acceptedAt, normaliseCode, voucherState } from "@/modules/vouchers/shared/rules";
import { manager, NOT_MANAGER, OTHER_SITES, refresh, siteOf } from "@/modules/vouchers/shared/server";

/** One voucher's writes: marking it as used needs `vouchers.redeem` at the site it is used at;
 *  putting a mistake right or cancelling a voucher needs `vouchers.manage`. Every write is audited. */

/** Mark a voucher as used at a site. The code must be valid today, accepted at that site and not
 *  used or cancelled; two desks at once cannot both use it. */
export async function redeemVoucher(codeInput: string, siteId: string): Promise<ActionResult> {
  const who = await requireVouchersActor();
  const code = normaliseCode(codeInput);
  if (!code) return fail("That is not a voucher code. Check each character.");
  const site = await liveSiteById(siteId);
  if (!site?.orgId || site.orgId !== who.orgId) return fail("That site is not open.");
  if (!(await mayFor("vouchers.redeem", { siteId, orgId: site.orgId }))) return fail("You can only use vouchers at the sites your level covers.");
  const voucher = await prisma.voucher.findFirst({
    where: { code, orgId: site.orgId },
    select: { id: true, batchId: true, redeemedAt: true, voidedAt: true, batch: { select: { service: true, recipient: true, siteIds: true, validFrom: true, validUntil: true, voidedAt: true } } },
  });
  if (!voucher) return fail(`No voucher has the code ${code}.`);
  const state = voucherState({ redeemed: voucher.redeemedAt !== null, voided: voucher.voidedAt !== null }, validity(voucher.batch), today());
  if (state === "used") return fail("This voucher has already been used.");
  if (state === "void") return fail("This voucher was cancelled and cannot be used.");
  if (state === "upcoming") return fail(`This voucher cannot be used until ${formatDate(voucher.batch.validFrom)}.`);
  if (state === "expired") return fail(`This voucher expired on ${formatDate(voucher.batch.validUntil)}.`);
  if (!acceptedAt(voucher.batch, siteId)) return fail(`This voucher is not accepted at ${site.name}.`);
  const result = await prisma.$transaction(async (tx) => {
    // Claim it first, so a second desk with the same code is told it was used.
    const claimed = await tx.voucher.updateMany({ where: { id: voucher.id, redeemedAt: null, voidedAt: null }, data: { redeemedAt: new Date(), redeemedSiteId: siteId, redeemedById: who.id, redeemedByName: who.name } });
    if (claimed.count !== 1) return fail("This voucher was used just now at another desk.");
    await logAudit({ actorId: who.id, actorName: who.name, action: "redeem", entity: "Voucher", entityId: voucher.id, clubId: siteId,
      summary: `Used voucher ${code} at ${site.name}: ${voucher.batch.service}, given to ${voucher.batch.recipient}` }, tx);
    return ok();
  });
  if (result.ok) refresh(voucher.batchId);
  return result;
}

/** Put right a voucher marked as used by mistake: it can be used again. */
export async function unredeemVoucher(id: string): Promise<ActionResult> {
  const who = await manager();
  if (!who) return fail(NOT_MANAGER);
  const voucher = await prisma.voucher.findFirst({ where: { id, orgId: who.orgId }, select: { code: true, batchId: true, redeemedAt: true, redeemedSiteId: true, redeemedByName: true } });
  if (!voucher) return fail("That voucher no longer exists.");
  if (!voucher.redeemedAt || !voucher.redeemedSiteId) return fail("That voucher is not marked as used.");
  if (!coversAll(who.sites, [voucher.redeemedSiteId])) return fail("It was used at a site your level does not cover.");
  const siteId = voucher.redeemedSiteId;
  const result = await prisma.$transaction(async (tx) => {
    const undone = await tx.voucher.updateMany({ where: { id, redeemedAt: { not: null } }, data: { redeemedAt: null, redeemedSiteId: null, redeemedById: null, redeemedByName: null } });
    if (undone.count !== 1) return fail("Someone changed this voucher just now.");
    await logAudit({ actorId: who.id, actorName: who.name, action: "restore", entity: "Voucher", entityId: id, clubId: siteId,
      summary: `Marked voucher ${voucher.code} as not used (it was marked used by ${voucher.redeemedByName})` }, tx);
    return ok();
  });
  if (result.ok) refresh(voucher.batchId);
  return result;
}

/** Cancel one unused voucher, for example one reported lost. */
export async function voidVoucher(id: string): Promise<ActionResult> {
  const who = await manager();
  if (!who) return fail(NOT_MANAGER);
  const voucher = await prisma.voucher.findFirst({ where: { id, orgId: who.orgId }, select: { code: true, batchId: true, redeemedAt: true, voidedAt: true, batch: { select: { siteIds: true, recipient: true } } } });
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
  if (result.ok) refresh(voucher.batchId);
  return result;
}
