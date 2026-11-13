import "server-only";
import { notFound } from "next/navigation";
import { liveSitesWithin, organisationName, sitesByIds } from "@/lib/directory";
import { today, toDateOnlyString } from "@/lib/format";
import { sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { requireVouchersActor } from "@/modules/vouchers/shared/access";
import { BATCH, covers, coversAll, siteNames, touching, validity } from "@/modules/vouchers/shared/reads";
import { batchState, voucherState } from "@/modules/vouchers/shared/rules";

/** The reads for whoever gives vouchers out. Batches are limited to those that name a site
 *  `vouchers.manage` covers; any other batch is a 404. */

/** Every batch that names one of this person's sites, newest first, under its occasion. */
export async function batchesPage() {
  const who = await requireVouchersActor();
  if (!who.manage) notFound();
  const sites = await sitesFor("vouchers.manage");
  const day = today();
  const rows = await prisma.voucherBatch.findMany({
    where: { orgId: who.orgId ?? undefined, ...touching(sites) },
    orderBy: { createdAt: "desc" }, take: 300,
    select: { ...BATCH, _count: { select: { vouchers: { where: { redeemedAt: { not: null } } } } } },
  });
  const names = await siteNames(rows.flatMap((b) => b.siteIds));
  const batches = rows.map((b) => ({ ...b, used: b._count.vouchers, state: batchState(validity(b), day), siteNames: names(b.siteIds) }));
  const occasions = [...new Set(batches.map((b) => b.occasion))].map((occasion) => {
    const own = batches.filter((b) => b.occasion === occasion);
    // A cancelled batch's unused vouchers were never out there to use; its used ones still count.
    const given = own.reduce((n, b) => n + (b.state === "void" ? b.used : b.quantity), 0);
    return { occasion, batches: own, given, used: own.reduce((n, b) => n + b.used, 0) };
  });
  return { who, occasions };
}
export type BatchRow = Awaited<ReturnType<typeof batchesPage>>["occasions"][number]["batches"][number];

/** One batch with every voucher in it. A 404 unless it names one of this person's sites. */
export async function batchPage(id: string) {
  const who = await requireVouchersActor();
  if (!who.manage) notFound();
  const sites = await sitesFor("vouchers.manage");
  const batch = await prisma.voucherBatch.findFirst({
    where: { id, orgId: who.orgId ?? undefined, ...touching(sites) },
    select: { ...BATCH, vouchers: { orderBy: { number: "asc" }, select: { id: true, number: true, code: true, redeemedAt: true, redeemedByName: true, redeemedSiteId: true, voidedAt: true } } },
  });
  if (!batch) notFound();
  const names = await siteNames([...batch.siteIds, ...batch.vouchers.flatMap((v) => v.redeemedSiteId ?? [])]);
  const day = today();
  const valid = validity(batch);
  const vouchers = batch.vouchers.map((v) => ({
    ...v, state: voucherState({ redeemed: v.redeemedAt !== null, voided: v.voidedAt !== null }, valid, day),
    redeemedSiteName: v.redeemedSiteId ? names([v.redeemedSiteId])[0] ?? null : null,
  }));
  const count = (state: string) => vouchers.filter((v) => v.state === state).length;
  return {
    who, batch: { ...batch, vouchers, state: batchState(valid, day), siteNames: names(batch.siteIds) },
    counts: { used: count("used"), open: count("valid") + count("upcoming"), expired: count("expired"), void: count("void") },
    canChange: coversAll(sites, batch.siteIds),
  };
}

/** What a new batch (or a change to one) is made from: the sites this person may give vouchers
 *  for, and what was typed before, offered as suggestions. */
export async function batchForm(id?: string) {
  const who = await requireVouchersActor();
  if (!who.manage) notFound();
  const sites = await sitesFor("vouchers.manage");
  const [live, earlier, existing] = await Promise.all([
    liveSitesWithin(who.orgId, sites),
    prisma.voucherBatch.findMany({ where: { orgId: who.orgId ?? undefined }, orderBy: { createdAt: "desc" }, take: 200, select: { occasion: true, service: true, recipient: true } }),
    id ? prisma.voucherBatch.findFirst({ where: { id, orgId: who.orgId ?? undefined, voidedAt: null }, select: BATCH }) : null,
  ]);
  if (id && (!existing || !coversAll(sites, existing.siteIds))) notFound();
  // A site archived since stays on the batch it was already on.
  const kept = existing ? [...(await sitesByIds(existing.siteIds.filter((s) => !live.some((l) => l.id === s && covers(sites, s))))).values()] : [];
  const distinct = (key: "occasion" | "service" | "recipient") => [...new Set(earlier.map((b) => b[key]))].slice(0, 30);
  return {
    who, existing: existing ? { ...existing, validFrom: toDateOnlyString(existing.validFrom), validUntil: toDateOnlyString(existing.validUntil) } : null,
    sites: [...live, ...kept].map(({ id, name }) => ({ id, name })),
    today: today(),
    suggestions: { occasions: distinct("occasion"), services: distinct("service"), recipients: distinct("recipient") },
  };
}

/** The sheet to print: the vouchers still to hand out (not used, not cancelled). */
export async function printPage(id: string) {
  const { who, batch } = await batchPage(id);
  return { batch, organisation: who.orgId ? await organisationName(who.orgId) : "", vouchers: batch.vouchers.filter((v) => v.state === "valid" || v.state === "upcoming") };
}
