import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FilePlus2, Truck } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PoStatusTag } from "@/components/purchasing/status";
import { formatDate, plural } from "@/lib/format";
import { purchasingHome, type OrderRow } from "@/lib/purchasing/data";
import { euro, type PoStatus } from "@/lib/purchasing/rules";

export const metadata: Metadata = { title: "Purchase orders" };

/** Purchasing's first page: what waits for this person's approval, their own
 *  orders, and the latest at their sites. */
export default async function PurchasingPage() {
  const { who, waiting, mine, recent, suppliers } = await purchasingHome();
  const others = recent.filter((o) => o.requestedById !== who.id && !waiting.some((w) => w.id === o.id));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Purchase orders"
        description={`Orders from approved suppliers, approved by role and amount, then numbered for the supplier.${suppliers ? ` ${plural(suppliers, "approved supplier")}.` : ""}`}
        actions={<>
          <Button asChild variant="outline"><Link href="/purchasing/suppliers"><Truck aria-hidden="true" />Suppliers</Link></Button>
          {who.request ? <Button asChild><Link href="/purchasing/new"><FilePlus2 aria-hidden="true" />New order</Link></Button> : null}
        </>} />

      {waiting.length ? <Panel id="po-waiting" title={`Waiting for your approval · ${waiting.length}`} orders={waiting} /> : null}
      {who.request || mine.length ? (
        <Panel id="po-mine" title="Your orders" orders={mine}
          empty={suppliers ? { title: "You have not raised an order yet", hint: "New order lists the approved suppliers and their products." }
            : { title: "No approved suppliers yet", hint: "Whoever manages Purchasing adds them, with their products and who approves." }} />
      ) : null}
      <Panel id="po-recent" title="Latest at your sites" orders={others} empty={{ title: "No orders at your sites yet" }} />
    </div>
  );
}

function Panel({ id, title, orders, empty }: { id: string; title: string; orders: OrderRow[]; empty?: { title: string; hint?: string } }) {
  return (
    <section aria-labelledby={`${id}-h`} id={id} className="pc-panel">
      <div className="pc-panel-head"><h2 id={`${id}-h`}>{title}</h2></div>
      {orders.length === 0 ? (
        <EmptyState compact icon="receipt" title={empty?.title ?? "None"} hint={empty?.hint} />
      ) : (
        <ul className="pc-rows">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/purchasing/${o.id}`} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title tabular-nums">{o.number ?? o.supplier.name}</span>
                  <span className="pc-row-hint">
                    {[o.number ? o.supplier.name : null, o.site.name, plural(o._count.lines, "line"), `by ${o.requestedByName}`, formatDate(o.submittedAt ?? o.createdAt)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="pc-row-trail">
                  <span className="font-semibold tabular-nums">{euro(o.totalCents)}</span>
                  <PoStatusTag status={o.status as PoStatus} />
                  <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
