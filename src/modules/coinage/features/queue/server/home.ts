import "server-only";
import { prisma } from "@/lib/prisma";
import { coinageAccess } from "@/modules/coinage/shared/auth";
import { coinageVisibility } from "@/modules/coinage/shared/data";
import type { HomeItem, HomeViewer } from "@/modules/contributions";

/** Coinage on the home page: what waits for this person, counted within what they may already
 *  see on the Coinage list. Registered in module.ts. */
export async function coinageHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const who = coinageAccess(viewer);
  if (!who) return [];
  const count = (status: string | string[], mine = false) => prisma.coinageRequest.count({
    where: { AND: [coinageVisibility(who), { status: typeof status === "string" ? status : { in: status } }, ...(mine ? [{ creatorId: who.id }] : [])] },
  });
  const items: HomeItem[] = [];
  if (who.review) {
    const n = await count(["SUBMITTED", "IN_REVIEW"]);
    items.push({ label: "Coinage requests to decide", hint: "From the desks", href: "/coinage?status=review", count: n, attention: n > 0 });
  }
  if (who.process) {
    const n = await count("APPROVED");
    items.push({ label: "Approved coinage to order", hint: "Approved, not ordered yet", href: "/coinage?status=APPROVED", count: n, attention: n > 0 });
  }
  if (who.request) {
    const info = await count("NEEDS_INFORMATION", true);
    if (info > 0) items.push({ label: "Your coinage requests need more information", hint: "Sent back to you", href: "/coinage?status=NEEDS_INFORMATION", count: info, attention: true });
    items.push({ kind: "action", label: "Request coinage", href: "/coinage/new" });
  }
  return items;
}
