import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { formatDateTime, formatDay } from "@/lib/format";
import { CountSheet, DeleteCount, STOCK_TAKE_META, stockTake } from "@/modules/stock/features/counts";

export const metadata: Metadata = { title: "Stock count" };

/** One count and its sheet (docs/stock.md). Count counts and submits it while it is open; View
 *  reads it; Manage may delete it. */
export default async function StockCountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { take, products, canCount, canDelete } = await stockTake(id);
  const when = [`Started by ${take.startedByName}, ${formatDateTime(take.startedAt)}`,
    take.submittedAt ? `submitted by ${take.submittedByName ?? "someone"}, ${formatDateTime(take.submittedAt)}` : null].filter(Boolean).join("; ");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: "/stock", label: "Stock counts" }} title={`${take.site.name}, ${formatDay(take.stockDate)}`} description={`${when}.${take.notes ? ` ${take.notes}` : ""}`}
        status={<Tag meta={STOCK_TAKE_META[take.state]} />}
        actions={canDelete ? <DeleteCount id={take.id} label={`${take.site.name} ${formatDay(take.stockDate)}`} /> : undefined} />
      <CountSheet takeId={take.id} products={products} lines={take.lines} canCount={canCount} />
    </div>
  );
}
