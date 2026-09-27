import "server-only";
import { hrConfigured } from "@/lib/hr/database";
import { REVIEW_STATUS_META } from "@/lib/hr/constants";
import { mySharedHr } from "@/lib/hr/mine";
import type { MyItem, MyProvider } from "@/modules/my/types";

/** HR's My surface in the hub: only that something was shared, never its
 *  content. Reading it opens /me/hr, which asks for a recent password. */
export const hrShared: MyProvider = {
  id: "hr.shared",
  moduleId: "hr",
  title: "Shared with you by HR",
  empty: "Nothing has been shared with you.",
  more: { href: "/me/hr", label: "Open your HR record" },
  appliesTo: () => hrConfigured(),
  async load({ userId, orgId }) {
    const { notes, reviews } = await mySharedHr(userId, orgId ?? "");
    const items: MyItem[] = reviews.map((r) => ({
      id: r.id,
      title: `Performance review: ${r.period}`,
      detail: `From ${r.reviewerName}`,
      status: REVIEW_STATUS_META[r.status],
      href: "/me/hr",
      needsAction: r.status === "shared",
    }));
    if (notes.length) items.push({ id: "hr-notes", title: `${notes.length} ${notes.length === 1 ? "note" : "notes"} shared with you`, href: "/me/hr" });
    return items;
  },
};
