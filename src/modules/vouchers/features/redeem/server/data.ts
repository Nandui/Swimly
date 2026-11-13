import "server-only";
import { currentClubIdIfAny } from "@/lib/clubs/current";
import { liveSitesWithin } from "@/lib/directory";
import { today } from "@/lib/format";
import { sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { requireVouchersActor } from "@/modules/vouchers/shared/access";
import { BATCH, covers, coversAll, siteNames, validity } from "@/modules/vouchers/shared/reads";
import { acceptedAt, normaliseCode, voucherState } from "@/modules/vouchers/shared/rules";

/** The desk's reads. A code can be checked by anyone who redeems anywhere, so reception can say
 *  "not at this site"; using it is limited to the sites `vouchers.redeem` covers. */

/** The Redeem page: one code checked, and the latest vouchers used at this person's sites. */
export async function redeemPage(input?: string) {
  const who = await requireVouchersActor();
  const [redeemSites, manageSites, working] = await Promise.all([
    sitesFor("vouchers.redeem"), who.manage ? sitesFor("vouchers.manage") : null, currentClubIdIfAny(),
  ]);
  const mine = await liveSitesWithin(who.orgId, redeemSites);
  const day = today();
  const typed = input?.trim().slice(0, 40) ?? "";
  const code = typed ? normaliseCode(typed) : null;
  const [row, latest] = await Promise.all([
    code ? prisma.voucher.findFirst({
      where: { code, orgId: who.orgId ?? undefined },
      select: { id: true, code: true, number: true, redeemedAt: true, redeemedSiteId: true, redeemedById: true, redeemedByName: true, voidedAt: true, voidedByName: true, batch: { select: BATCH } },
    }) : null,
    prisma.voucher.findMany({
      where: { orgId: who.orgId ?? undefined, redeemedAt: { not: null }, redeemedSiteId: { in: mine.map((s) => s.id) } },
      orderBy: { redeemedAt: "desc" }, take: 10,
      select: { id: true, code: true, redeemedAt: true, redeemedSiteId: true, redeemedByName: true, batch: { select: { service: true, recipient: true } } },
    }),
  ]);
  const names = await siteNames([...(row ? [...row.batch.siteIds, row.redeemedSiteId ?? ""] : []), ...latest.map((v) => v.redeemedSiteId ?? "")].filter(Boolean));
  const found = row ? (() => {
    const state = voucherState({ redeemed: row.redeemedAt !== null, voided: row.voidedAt !== null }, validity(row.batch), day);
    // Where this person could use it: their sites that the batch accepts, the one they are working at first.
    const here = mine.filter((s) => acceptedAt(row.batch, s.id)).sort((a, b) => Number(b.id === working) - Number(a.id === working));
    return {
      ...row, state,
      acceptedNames: names(row.batch.siteIds),
      redeemedSiteName: row.redeemedSiteId ? names([row.redeemedSiteId])[0] ?? null : null,
      redeemAt: state === "valid" ? here.map(({ id, name }) => ({ id, name })) : [],
      /** Just marked as used by this person: the page confirms it instead of warning. */
      justNow: row.redeemedById === who.id && row.redeemedAt !== null && Date.now() - row.redeemedAt.getTime() < 5 * 60 * 1000,
      canUndo: state === "used" && !!manageSites && !!row.redeemedSiteId && covers(manageSites, row.redeemedSiteId),
      canVoid: (state === "valid" || state === "upcoming") && !!manageSites && coversAll(manageSites, row.batch.siteIds),
      canOpenBatch: !!manageSites && row.batch.siteIds.some((id) => covers(manageSites, id)),
    };
  })() : null;
  return {
    who, typed, found, hasSites: mine.length > 0,
    latest: latest.map((v) => ({ ...v, siteName: v.redeemedSiteId ? names([v.redeemedSiteId])[0] ?? null : null })),
  };
}
