import "server-only";
import { notFound } from "next/navigation";
import { currentClubIdIfAny } from "@/lib/clubs/current";
import { today, toDateOnlyString } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sitesFor } from "@/lib/policy/session";
import { requireVouchersActor, type VouchersActor } from "@/lib/vouchers/access";
import { acceptedAt, batchState, normaliseCode, voucherState, type Validity } from "@/lib/vouchers/rules";

/** The Vouchers reads (docs/vouchers.md). A code can be checked by anyone who
 *  redeems anywhere, so reception can say "not at this site"; batches are
 *  limited to those that name a site `vouchers.manage` covers. */

type Sites = Awaited<ReturnType<typeof sitesFor>>;
const covers = (sites: Sites, siteId: string) => sites.kind === "all" || sites.siteIds.has(siteId);
/** Every one of these sites is covered: what changing a batch needs. */
export const coversAll = (sites: Sites, siteIds: readonly string[]) => siteIds.every((id) => covers(sites, id));
/** Batches that name at least one covered site. */
const touching = (sites: Sites) => (sites.kind === "all" ? {} : { siteIds: { hasSome: [...sites.siteIds] } });

export const validity = (b: { validFrom: Date; validUntil: Date; voidedAt: Date | null }): Validity =>
  ({ validFrom: toDateOnlyString(b.validFrom), validUntil: toDateOnlyString(b.validUntil), voided: b.voidedAt !== null });

/** The organisation's sites, archived ones too, so an old batch still names its sites. */
async function allSites(who: VouchersActor) {
  return prisma.club.findMany({ where: { orgId: who.orgId ?? undefined }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, archivedAt: true } });
}
const namesOf = (clubs: { id: string; name: string }[], ids: readonly string[]) => clubs.filter((c) => ids.includes(c.id)).map((c) => c.name);

const BATCH = {
  id: true, occasion: true, recipient: true, contactName: true, contactDetail: true, service: true, quantity: true, validFrom: true, validUntil: true,
  siteIds: true, terms: true, note: true, createdByName: true, createdAt: true, voidedAt: true, voidedByName: true, voidReason: true,
} as const;

/** The first page: one code checked, and the latest vouchers used at this person's sites. */
export async function redeemPage(input?: string) {
  const who = await requireVouchersActor();
  const [redeemSites, manageSites, clubs, working] = await Promise.all([
    sitesFor("vouchers.redeem"), who.manage ? sitesFor("vouchers.manage") : null, allSites(who), currentClubIdIfAny(),
  ]);
  const mine = clubs.filter((c) => !c.archivedAt && covers(redeemSites, c.id));
  const day = today();
  const typed = input?.trim().slice(0, 40) ?? "";
  const code = typed ? normaliseCode(typed) : null;
  const [row, latest] = await Promise.all([
    code ? prisma.voucher.findFirst({
      where: { code, batch: { orgId: who.orgId ?? undefined } },
      select: { id: true, code: true, number: true, redeemedAt: true, redeemedSiteId: true, redeemedById: true, redeemedByName: true, voidedAt: true, voidedByName: true, batch: { select: BATCH } },
    }) : null,
    prisma.voucher.findMany({
      where: { redeemedAt: { not: null }, redeemedSiteId: { in: mine.map((c) => c.id) }, batch: { orgId: who.orgId ?? undefined } },
      orderBy: { redeemedAt: "desc" }, take: 10,
      select: { id: true, code: true, redeemedAt: true, redeemedByName: true, redeemedSite: { select: { name: true } }, batch: { select: { service: true, recipient: true } } },
    }),
  ]);
  const found = row ? (() => {
    const state = voucherState({ redeemed: row.redeemedAt !== null, voided: row.voidedAt !== null }, validity(row.batch), day);
    // Where this person could use it: their sites that the batch accepts, the one they are working at first.
    const here = mine.filter((c) => acceptedAt(row.batch, c.id)).sort((a, b) => Number(b.id === working) - Number(a.id === working));
    return {
      ...row, state,
      acceptedNames: namesOf(clubs, row.batch.siteIds),
      redeemedSiteName: clubs.find((c) => c.id === row.redeemedSiteId)?.name ?? null,
      redeemAt: state === "valid" ? here.map(({ id, name }) => ({ id, name })) : [],
      /** Just marked as used by this person: the page confirms it instead of warning. */
      justNow: row.redeemedById === who.id && row.redeemedAt !== null && Date.now() - row.redeemedAt.getTime() < 5 * 60 * 1000,
      canUndo: state === "used" && !!manageSites && !!row.redeemedSiteId && covers(manageSites, row.redeemedSiteId),
      canVoid: (state === "valid" || state === "upcoming") && !!manageSites && coversAll(manageSites, row.batch.siteIds),
      canOpenBatch: !!manageSites && row.batch.siteIds.some((id) => covers(manageSites, id)),
    };
  })() : null;
  return { who, typed, found, latest, hasSites: mine.length > 0 };
}

/** Every batch that names one of this person's sites, newest first, under its occasion. */
export async function batchesPage() {
  const who = await requireVouchersActor();
  if (!who.manage) notFound();
  const [sites, clubs] = await Promise.all([sitesFor("vouchers.manage"), allSites(who)]);
  const day = today();
  const rows = await prisma.voucherBatch.findMany({
    where: { orgId: who.orgId ?? undefined, ...touching(sites) },
    orderBy: { createdAt: "desc" }, take: 300,
    select: { ...BATCH, _count: { select: { vouchers: { where: { redeemedAt: { not: null } } } } } },
  });
  const batches = rows.map((b) => ({ ...b, used: b._count.vouchers, state: batchState(validity(b), day), siteNames: namesOf(clubs, b.siteIds) }));
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
  const [sites, clubs] = await Promise.all([sitesFor("vouchers.manage"), allSites(who)]);
  const batch = await prisma.voucherBatch.findFirst({
    where: { id, orgId: who.orgId ?? undefined, ...touching(sites) },
    select: { ...BATCH, vouchers: { orderBy: { number: "asc" }, select: { id: true, number: true, code: true, redeemedAt: true, redeemedByName: true, redeemedSiteId: true, voidedAt: true } } },
  });
  if (!batch) notFound();
  const day = today();
  const valid = validity(batch);
  const vouchers = batch.vouchers.map((v) => ({
    ...v, state: voucherState({ redeemed: v.redeemedAt !== null, voided: v.voidedAt !== null }, valid, day),
    redeemedSiteName: clubs.find((c) => c.id === v.redeemedSiteId)?.name ?? null,
  }));
  const count = (state: string) => vouchers.filter((v) => v.state === state).length;
  return {
    who, batch: { ...batch, vouchers, state: batchState(valid, day), siteNames: namesOf(clubs, batch.siteIds) },
    counts: { used: count("used"), open: count("valid") + count("upcoming"), expired: count("expired"), void: count("void") },
    canChange: coversAll(sites, batch.siteIds),
  };
}

/** What a new batch (or a change to one) is made from: the sites this person may
 *  give vouchers for, and what was typed before, offered as suggestions. */
export async function batchForm(id?: string) {
  const who = await requireVouchersActor();
  if (!who.manage) notFound();
  const [sites, clubs, earlier] = await Promise.all([
    sitesFor("vouchers.manage"), allSites(who),
    prisma.voucherBatch.findMany({ where: { orgId: who.orgId ?? undefined }, orderBy: { createdAt: "desc" }, take: 200, select: { occasion: true, service: true, recipient: true } }),
  ]);
  const existing = id ? await prisma.voucherBatch.findFirst({ where: { id, orgId: who.orgId ?? undefined, voidedAt: null }, select: BATCH }) : null;
  if (id && (!existing || !coversAll(sites, existing.siteIds))) notFound();
  const distinct = (key: "occasion" | "service" | "recipient") => [...new Set(earlier.map((b) => b[key]))].slice(0, 30);
  return {
    who, existing: existing ? { ...existing, validFrom: toDateOnlyString(existing.validFrom), validUntil: toDateOnlyString(existing.validUntil) } : null,
    sites: clubs.filter((c) => (!c.archivedAt || existing?.siteIds.includes(c.id)) && covers(sites, c.id)).map(({ id, name }) => ({ id, name })),
    today: today(),
    suggestions: { occasions: distinct("occasion"), services: distinct("service"), recipients: distinct("recipient") },
  };
}

/** The sheet to print: the vouchers still to hand out (not used, not cancelled). */
export async function printPage(id: string) {
  const { who, batch } = await batchPage(id);
  const org = who.orgId ? await prisma.organisation.findUnique({ where: { id: who.orgId }, select: { name: true } }) : null;
  return { batch, organisation: org?.name ?? "", vouchers: batch.vouchers.filter((v) => v.state === "valid" || v.state === "upcoming") };
}
