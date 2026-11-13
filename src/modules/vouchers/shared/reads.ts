import { sitesByIds } from "@/lib/directory";
import { toDateOnlyString } from "@/lib/format";
import type { sitesFor } from "@/lib/policy/session";
import type { Validity } from "@/modules/vouchers/shared/rules";

/** What the reads and writes share: which sites a person's level covers, and a batch's dates as
 *  the rules take them. Sites are the platform's, so their names come from the directory. */

export type Sites = Awaited<ReturnType<typeof sitesFor>>;
export const covers = (sites: Sites, siteId: string) => sites.kind === "all" || sites.siteIds.has(siteId);
/** Every one of these sites is covered: what changing a batch needs. */
export const coversAll = (sites: Sites, siteIds: readonly string[]) => siteIds.every((id) => covers(sites, id));
/** Batches that name at least one covered site. */
export const touching = (sites: Sites) => (sites.kind === "all" ? {} : { siteIds: { hasSome: [...sites.siteIds] } });

export const validity = (b: { validFrom: Date; validUntil: Date; voidedAt: Date | null }): Validity =>
  ({ validFrom: toDateOnlyString(b.validFrom), validUntil: toDateOnlyString(b.validUntil), voided: b.voidedAt !== null });

/** The names of these sites, archived ones too, in the order given: an old batch still names its sites. */
export async function siteNames(ids: readonly string[]) {
  const sites = await sitesByIds(ids);
  return (list: readonly string[]) => list.flatMap((id) => sites.get(id)?.name ?? []);
}

export const BATCH = {
  id: true, occasion: true, recipient: true, contactName: true, contactDetail: true, service: true, quantity: true, validFrom: true, validUntil: true,
  siteIds: true, terms: true, note: true, createdByName: true, createdAt: true, voidedAt: true, voidedByName: true, voidReason: true,
} as const;
