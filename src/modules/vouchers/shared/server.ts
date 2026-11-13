import { revalidatePath } from "next/cache";
import { sitesFor } from "@/lib/policy/session";
import { requireVouchersActor } from "@/modules/vouchers/shared/access";

/** What the writes share: the pages to refresh, and whoever gives vouchers out with the sites
 *  their level covers. */

export function refresh(batchId?: string) {
  revalidatePath("/vouchers");
  revalidatePath("/vouchers/batches");
  if (batchId) revalidatePath(`/vouchers/batches/${batchId}`);
}

export const NOT_MANAGER = "Giving out vouchers needs Vouchers Manage.";
export const OTHER_SITES = "This batch includes a site your level does not cover.";

/** The signed-in person, if they hold Manage anywhere, with the sites it covers. */
export async function manager() {
  const who = await requireVouchersActor();
  if (!who.manage || !who.orgId) return null;
  return { ...who, orgId: who.orgId, sites: await sitesFor("vouchers.manage") };
}

/** A batch's audit entry belongs to its site when it has one, otherwise to none. */
export const siteOf = (siteIds: readonly string[]) => (siteIds.length === 1 ? siteIds[0] : null);
