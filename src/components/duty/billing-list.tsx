import { BillingReview, type BillingCancellation } from "./billing-review";
import { Item, ItemGroup, ItemContent } from "@/components/shadcn/item";
import { Tag } from "@/components/ui-kit/tag";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { CANCELLATION_META } from "@/lib/cancellations/constants";
import { formatDate, parseDateOnly } from "@/lib/format";
import { formatTime } from "@/lib/courses/constants";

export function BillingList({ rows, canNotify, notified }: { rows: BillingCancellation[]; canNotify: boolean; notified: boolean }) {
  if (!rows.length) return <EmptyState title={notified ? "No billing notifications recorded" : "No cancellations awaiting billing"} hint={notified ? "Completed handoffs will stay here for reference." : "Cancelled class sessions will appear here with their affected swimmers."} />;
  return <ItemGroup className="divide-y divide-ui-border border-y border-ui-border">{rows.map(row => {
    const meta = row.billingNotifiedAt ? CANCELLATION_META.notified : CANCELLATION_META.pending;
    return <Item key={row.id} role="listitem" className="flex-wrap rounded-none px-0 py-5"><div className="w-28 shrink-0"><p className="text-sm font-medium">{formatDate(parseDateOnly(row.date))}</p><p className="text-sm tabular-nums text-ui-muted-foreground">{formatTime(row.startMinutes)}</p></div><ItemContent className="min-w-0 basis-48"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{row.className}</h2><Tag color={meta.color}>{meta.label}</Tag></div><p className="text-sm text-ui-muted-foreground">{row.programmeName} · {row.location || "Pool area not set"} · {row.swimmers.length} affected swimmers</p><p className="line-clamp-2 break-words text-sm">{row.reason}</p></ItemContent><BillingReview row={row} canNotify={canNotify} /></Item>;
  })}</ItemGroup>;
}
