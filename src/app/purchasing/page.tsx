import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, FilePlus2, Hourglass, ReceiptText, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
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
    <div className="po-desk">
      <PageHeader title="Purchase orders"
        description="Orders from approved suppliers, approved by role and amount, then numbered for the supplier."
        actions={<>
          <Button asChild variant="outline"><Link href="/purchasing/suppliers"><Truck aria-hidden="true" />Suppliers</Link></Button>
          {who.request ? <Button asChild><Link href="/purchasing/new"><FilePlus2 aria-hidden="true" />New order</Link></Button> : null}
        </>} />

      <div className="po-stats">
        <Stat href={waiting.length ? "#po-waiting" : undefined} tone={waiting.length ? "act" : undefined} icon={Hourglass} n={waiting.length}
          label="Waiting for your approval" hint={waiting.length ? `${euro(waiting.reduce((t, o) => t + o.totalCents, 0))} before VAT in all` : "Nothing waits for you"} />
        {showMine ? (
          <Stat href="#po-mine" icon={ReceiptText} n={open.length} label="Your open orders"
            hint={toChange ? `${plural(toChange, "draft or rejected order")} to finish` : open.length ? "All sent for approval" : "None open"} />
        ) : null}
        <Stat href="/purchasing/suppliers" icon={Truck} n={suppliers} label="Approved suppliers" hint="Orders can only be raised with these" />
      </div>

      {waiting.length ? <Panel id="po-waiting" title="Waiting for your approval" orders={waiting} /> : null}
      {showMine ? (
        <Panel id="po-mine" title="Your orders" orders={mine}
          empty={suppliers ? { title: "You have not raised an order yet", hint: "New order lists the approved suppliers and their products." }
            : { title: "No approved suppliers yet", hint: "Whoever manages Purchasing adds them, with their products and who approves." }} />
      ) : null}
      <Panel id="po-recent" title="Latest at your sites" orders={others} empty={{ title: "No orders at your sites yet" }} />
    </div>
  );
}

/** One figure in its own card; a link when there is somewhere to go. */
function Stat({ href, tone, icon: Icon, n, label, hint }: { href?: string; tone?: "act"; icon: LucideIcon; n: number; label: string; hint: string }) {
  const body = (
    <>
      <span className="po-stat-top">
        <span className="po-stat-icon"><Icon aria-hidden="true" /></span>
        {href ? <ArrowUpRight aria-hidden="true" className="size-4 text-ui-muted-foreground" /> : null}
      </span>
      <span>
        <span className="po-stat-n block">{n}</span>
        <span className="po-stat-label block">{label}</span>
        <span className="po-stat-hint block">{hint}</span>
      </span>
    </>
  );
  return href ? <Link href={href} className="po-card po-stat" data-tone={tone}>{body}</Link> : <div className="po-card po-stat" data-tone={tone}>{body}</div>;
}

function Panel({ id, title, orders, empty }: { id: string; title: string; orders: OrderRow[]; empty?: { title: string; hint?: string } }) {
  return (
    <section aria-labelledby={`${id}-h`} id={id} className="po-card">
      <div className="po-card-head"><h2 id={`${id}-h`}>{title}{orders.length ? <span className="po-count">{orders.length}</span> : null}</h2></div>
      {orders.length === 0 ? (
        <EmptyState compact icon="receipt" title={empty?.title ?? "None"} hint={empty?.hint} />
      ) : (
        <ul className="pc-rows">
          {orders.map((o) => {
            const status = o.status as PoStatus;
            const Icon = PO_STATUS_META[status]?.icon ?? ReceiptText;
            return (
              <li key={o.id}>
                <Link href={`/purchasing/${o.id}`} className="pc-row" data-status={status}>
                  <span className="po-mark"><Icon aria-hidden="true" /></span>
                  <span className="pc-row-body">
                    <span className={o.number ? "po-row-number" : "pc-row-title"}>{o.number ?? o.supplier.name}</span>
                    <span className="pc-row-hint">
                      {[o.number ? o.supplier.name : null, o.site.name, plural(o._count.lines, "line"), `by ${o.requestedByName}`, formatDate(o.submittedAt ?? o.createdAt)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="pc-row-trail">
                    <span className="po-amount">{euro(o.totalCents)}</span>
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
