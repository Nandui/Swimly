import { revalidatePath } from "next/cache";
import { liveSiteById } from "@/lib/directory";
import { currentActor, mayFor } from "@/lib/policy/session";
import type { PermissionKey } from "@/lib/staff/permissions";

/** What the writes share: access at a count's site and the pages to refresh. */

export function refresh(takeId?: string) {
  revalidatePath("/stock");
  if (takeId) revalidatePath(`/stock/${takeId}`);
  revalidatePath("/stock/products");
  revalidatePath("/stock/categories");
}

const REFUSALS: Partial<Record<PermissionKey, string>> = {
  "stock.count": "Counting stock at this site needs Stock Count there.",
  "stock.manage": "Deleting a count at this site needs Stock Manage there.",
};

/** The signed-in person, if they hold `cap` at the site. */
export async function atSite(siteId: string, cap: PermissionKey) {
  const site = await liveSiteById(siteId);
  if (!site?.orgId) return { ok: false as const, error: "That site is not open." };
  if (!(await mayFor(cap, { siteId, orgId: site.orgId }))) return { ok: false as const, error: REFUSALS[cap] ?? "This needs Stock access at the count's site." };
  const actor = await currentActor();
  return { ok: true as const, actor: { id: actor.id, name: actor.name }, site: { id: site.id, name: site.name, orgId: site.orgId } };
}
