import "server-only";
import { prisma } from "@/lib/prisma";
import { refundAccess } from "@/lib/refunds/auth";
import { refundVisibility } from "@/lib/refunds/data";
import { registerHomeCard, type HomeItem } from "@/modules/contributions";

/** Refunds on the home page: what waits for this person, counted within what
 *  they may already see on the Refunds list. */
registerHomeCard({
  moduleId: "refunds",
  async items(viewer) {
    const who = refundAccess(viewer);
    if (!who) return [];
    const count = (status: string | string[], mine = false) => prisma.refundRequest.count({
      where: { AND: [refundVisibility(who), { status: typeof status === "string" ? status : { in: status } }, ...(mine ? [{ creatorId: who.id }] : [])] },
    });
    const items: HomeItem[] = [];
    if (who.review) {
      const n = await count(["SUBMITTED", "IN_REVIEW"]);
      items.push({ label: "Refund requests to decide", href: "/refunds?status=actionable", count: n, attention: n > 0 });
    }
    if (who.process) {
      const n = await count("APPROVED");
      items.push({ label: "Approved refunds to pay", href: "/refunds?status=APPROVED", count: n, attention: n > 0 });
    }
    if (who.request) {
      const info = await count("NEEDS_INFORMATION", true);
      if (info > 0) items.push({ label: "Your requests need more information", href: "/refunds?status=NEEDS_INFORMATION", count: info, attention: true });
      items.push({ label: "Log a refund request", hint: "For a customer at the desk", href: "/refunds/new" });
    }
    return items;
  },
});
