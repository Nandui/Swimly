import "server-only";
import { prisma } from "@/lib/prisma";
import { refundAccess } from "@/modules/refunds/shared/auth";
import { refundVisibility } from "@/modules/refunds/shared/data";
import type { HomeItem, HomeViewer } from "@/modules/contributions";

/** Refunds on the home page: what waits for this person, counted within what
 *  they may already see on the Refunds list. Registered in module.ts. */
export async function refundHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const who = refundAccess(viewer);
  if (!who) return [];
  const count = (status: string | string[], mine = false) => prisma.refundRequest.count({
    where: { AND: [refundVisibility(who), { status: typeof status === "string" ? status : { in: status } }, ...(mine ? [{ creatorId: who.id }] : [])] },
  });
  const items: HomeItem[] = [];
  if (who.review) {
    const n = await count(["SUBMITTED", "IN_REVIEW"]);
    items.push({ label: "Refund requests to decide", hint: "From the front desk", href: "/refunds?status=review", count: n, attention: n > 0 });
  }
  if (who.process) {
    const n = await count("APPROVED");
    items.push({ label: "Approved refunds to pay", hint: "Approved, waiting for payment", href: "/refunds?status=APPROVED", count: n, attention: n > 0 });
  }
  if (who.request) {
    const info = await count("NEEDS_INFORMATION", true);
    if (info > 0) items.push({ label: "Your requests need more information", hint: "Sent back to you", href: "/refunds?status=NEEDS_INFORMATION", count: info, attention: true });
    items.push({ kind: "action", icon: "receipt", label: "Log a refund request", href: "/refunds/new" });
  }
  return items;
}
