import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FilePlus2, Hourglass, ReceiptText, Truck } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Figure, Figures } from "@/components/ui-kit/figure";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { euro, type OrderRow, PO_STATUS_META, type PoStatus, PoStatusTag, purchasingHome } from "@/modules/purchasing/features/orders";
import { formatDate, plural } from "@/lib/format";

export const metadata: Metadata = { title: "Purchase orders" };

/** Purchasing's first page: three figures (what waits for this person's approval, their own
 *  open orders, the approved suppliers), then those orders and the latest at their sites. */
export default async function PurchasingPage() {
  const { who, waiting, mine, recent, suppliers } = await purchasingHome();
  const others = recent.filter((o) => o.requestedById !== who.id && !waiting.some((w) => w.id === o.id));
  const open = mine.filter((o) => o.status === "draft" || o.status === "pending" || o.status === "rejected");
  const toChange = mine.filter((o) => o.status === "draft" || o.status === "rejected").length;
  const showMine = who.request || mine.length > 0;
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Purchase orders"
        description="Orders from approved suppliers, approved by role and amount, then numbered for the supplier."
        actions={<>
          <Button asChild variant="outline"><Link href="/purchasing/suppliers"><Truck aria-hidden="true" />Suppliers</Link></Button>
          {who.request ? <Button asChild><Link href="/purchasing/new"><FilePlus2 aria-hidden="true" />New order</Link></Button> : null}
        </>} />}>

      <Figures label="Purchasing at a glance">
        <Figure href={waiting.length ? "#po-waiting" : undefined} icon={Hourglass} value={waiting.length} label="Waiting for your approval"
          hint={waiting.length ? `${euro(waiting.reduce((t, o) => t + o.totalCents, 0))} before VAT in all` : "Nothing waits for you"} tone={waiting.length ? "orange" : undefined} />
        {showMine ? (
          <Figure href="#po-mine" icon={ReceiptText} value={open.length} label="Your open orders"
            hint={toChange ? `${plural(toChange, "draft or rejected order")} to finish` : open.length ? "All sent for approval" : "None open"} tone={toChange ? "orange" : undefined} />
        ) : null}
        <Figure href="/purchasing/suppliers" icon={Truck} value={suppliers} label="Approved suppliers" hint="Orders can only be raised with these" />
      </Figures>

      {waiting.length ? <Panel id="po-waiting" title="Waiting for your approval" orders={waiting} /> : null}
      {showMine ? (
        <Panel id="po-mine" title="Your orders" orders={mine}
          empty={suppliers ? { title: "You have not raised an order yet", hint: "New order lists the approved suppliers and their products." }
            : { title: "No approved suppliers yet", hint: "Whoever manages Purchasing adds them, with their products and who approves." }} />
      ) : null}
      <Panel id="po-recent" title="Latest at your sites" orders={others} empty={{ title: "No orders at your sites yet" }} />
    </PageShell>
  );
}

/** An order's tile takes its status: orange while it waits, green once approved, red when rejected. */
const TONE: Partial<Record<PoStatus, "orange" | "green" | "red">> = { pending: "orange", approved: "green", rejected: "red" };

function Panel({ id, title, orders, empty }: { id: string; title: string; orders: OrderRow[]; empty?: { title: string; hint?: string } }) {
  return (
    <section aria-labelledby={`${id}-h`} id={id} className="flex min-w-0 scroll-mt-6 flex-col">
      <div className="pc-section-head"><h2 id={`${id}-h`}>{title}</h2>{orders.length ? <p>{orders.length}</p> : null}</div>
      {orders.length === 0 ? (
        <EmptyState icon="receipt" title={empty?.title ?? "None"} hint={empty?.hint} />
      ) : (
        <ul className="pc-list">
          {orders.map((o) => {
            const status = o.status as PoStatus;
            const Icon = PO_STATUS_META[status]?.icon ?? ReceiptText;
            return (
              <li key={o.id}>
                <Link href={`/purchasing/${o.id}`} className="pc-row">
                  <span className="pc-tile-icon" data-tone={TONE[status]} aria-hidden="true"><Icon /></span>
                  <span className="pc-row-body">
                    <span className="pc-row-title tabular-nums">{o.number ?? o.supplier.name}</span>
                    <span className="pc-row-hint">
                      {[o.number ? o.supplier.name : null, o.site.name, plural(o._count.lines, "line"), `by ${o.requestedByName}`, formatDate(o.submittedAt ?? o.createdAt)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="pc-row-trail">
                    <span className="pc-row-value">{euro(o.totalCents)}</span>
                    <PoStatusTag status={status} />
                    <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
