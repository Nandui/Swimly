import { BillingReview, type BillingCancellation } from "./billing-review";
import { Tag } from "@/components/ui-kit/tag";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { CANCELLATION_META } from "@/modules/activities/lib/cancellations/constants";
import { formatShortDay, formatTime, plural } from "@/lib/format";

const EMPTY = {
  awaiting: { title: "No cancellations awaiting billing", hint: "Cancelled class sessions will appear here with their affected swimmers." },
  restore: { title: "Nothing to restore", hint: "Classes processed in Legend wait here until the direct debit run is done." },
  done: { title: "Nothing done yet", hint: "Restored classes and earlier billing handoffs stay here for reference." },
};

export function BillingList({ rows, canNotify, view }: { rows: BillingCancellation[]; canNotify: boolean; view: "awaiting" | "restore" | "done" }) {
  if (!rows.length) return <EmptyState icon="calendarX" title={EMPTY[view].title} hint={EMPTY[view].hint} />;
  return <ul className="pc-rows">{rows.map(row => {
    const meta = row.restoredAt ? CANCELLATION_META.restored : row.legendProcessedAt ? CANCELLATION_META.restore : row.billingNotifiedAt ? CANCELLATION_META.notified : CANCELLATION_META.pending;
    return <li key={row.id} className="pc-row">
      <span className="pc-block w-28" data-state="off"><span className="pc-block-time">{formatShortDay(row.date)}<small>{formatTime(row.startMinutes)}</small></span></span>
      <div className="pc-row-body basis-48">
        <span className="flex flex-wrap items-center gap-2"><span className="pc-row-title">{row.className}</span><Tag meta={meta} /></span>
        <span className="pc-row-hint">{row.programmeName} · {row.location || "Pool area not set"} · {plural(row.swimmers.length, "affected swimmer")}</span>
        <span className="pc-row-hint line-clamp-2 break-words">{row.reason}</span>
      </div>
      <div className="pc-row-trail"><BillingReview row={row} canNotify={canNotify} /></div>
    </li>;
  })}</ul>;
}
