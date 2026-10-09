import type { Metadata } from "next";
import { BackLink } from "@/components/ui-kit/back-link";
import { PageHeader } from "@/components/ui-kit/page-header";
import { LegendPriceDialog } from "@/modules/activities/components/duty/billing-batch";
import { screenPage } from "@/lib/page-guards";
import { can } from "@/lib/authz";
import { getLegendPrices } from "@/modules/activities/lib/cancellations/data";

export const metadata: Metadata = { title: "Billing prices" };

const euro = (cents: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);

/** The swim school's billing prices (owner decision, 9 October 2026): the monthly price of each
 *  Legend agreement price, the same at every site, put in NewCycleFee by the restore export.
 *  Billing sees it; swim school Manage keeps it. Admin's overview links here. */
export default async function BillingPricesPage() {
  const session = await screenPage("cancellations");
  const prices = await getLegendPrices();
  const canEdit = can(session, "curriculum.manage");
  return <div className="flex min-w-0 flex-col gap-6">
    <BackLink href="/cancellations" label="Cancelled classes" />
    <PageHeader title="Billing prices" description="Each agreement price's monthly price in Legend. The price restore export puts it in NewCycleFee, to put members back on it after a cancellation." />
    <section className="pc-panel" aria-label="Agreement prices">
      <ul className="pc-rows">
        {prices.map((p) => (
          <li key={p.id} className="pc-row">
            <span className="pc-row-body">
              <span className="pc-row-title">{p.name}</span>
              <span className="pc-row-hint">Agreement Aquatics{p.updatedByName ? ` · set by ${p.updatedByName}` : ""}</span>
            </span>
            <span className="pc-row-trail">
              <span className="font-semibold tabular-nums">{p.monthlyCents === null ? "No price yet" : `${euro(p.monthlyCents)} a month`}</span>
              {canEdit ? <LegendPriceDialog price={p} /> : null}
            </span>
          </li>
        ))}
      </ul>
      {!canEdit ? <p className="text-xs text-ui-muted-foreground">Swim school Manage keeps these prices.</p> : null}
    </section>
  </div>;
}
