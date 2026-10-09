import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { BillingBatch, BillingList } from "@/modules/activities/features/duty";
import { screenPage } from "@/lib/page-guards";
import { can, canSee } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { agreementPriceFor, billingViewOf, getBillingCancellations, getLegendPrices } from "@/modules/activities/features/cancellations";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { ClipboardList, Euro } from "lucide-react";

export const metadata: Metadata = { title: "Cancelled classes" };

const HELP = {
  awaiting: "Export them for Legend, process the bulk update there, then mark them processed.",
  restore: "Processed in Legend. Once the direct debit run is done, export the price restore, update Legend, then mark them restored.",
  done: "Restored classes, and billing handoffs recorded by hand.",
};

/** The billing follow-up of cancelled classes (owner decisions, 9 October 2026): awaiting
 *  billing, then to restore after the direct debit run, then done. */
export default async function CancellationsPage({ searchParams }: { searchParams: Promise<{ status?: string; view?: string; page?: string }> }) {
  const session = await screenPage("cancellations"), params = await searchParams;
  const view = billingViewOf(params.view ?? params.status);
  const requested = Number(params.page), page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  const [data, { club }, prices] = await Promise.all([getBillingCancellations(view, page), getCurrentClub(), getLegendPrices()]);
  const fees = new Map(prices.map((p) => [p.name, p.monthlyCents]));
  const missing = [...new Set(data.rows.filter((r) => r.swimmers.length).map((r) => agreementPriceFor(r.programmeName)))].filter((n) => fees.get(n) == null).sort();
  return <div className="flex min-w-0 flex-col gap-6">
    <PageHeader title="Cancelled classes"
      description={`${club.name} · Billing follow-up across all dates. ${HELP[view]}`}
      actions={<>
        <Button asChild variant="outline"><Link href="/cancellations/prices"><Euro aria-hidden="true" />Billing prices</Link></Button>
        {canSee(session, "duty") ? <Button asChild variant="outline"><Link href="/duty"><ClipboardList aria-hidden="true" />Today&rsquo;s classes</Link></Button> : null}
      </>} />
    <section className="pc-panel" aria-label="Billing follow-up">
      <SegmentedLinks label="Billing follow-up status" items={[
        { href: "/cancellations", label: "Awaiting billing", count: data.pending, current: view === "awaiting" },
        { href: "/cancellations?view=restore", label: "To restore", count: data.restore, current: view === "restore" },
        { href: "/cancellations?view=done", label: "Done", current: view === "done" },
      ]} />
      {view !== "done" && data.total ? <BillingBatch view={view} ids={data.ids} canMark={can(session, "billing.notify")} missing={view === "restore" ? missing : []} /> : null}
      <BillingList canNotify={can(session, "billing.notify")} view={view} rows={data.rows.map(row => ({ ...row, date: row.date.toISOString().slice(0, 10), cancelledAt: row.cancelledAt.toISOString(),
        billingNotifiedAt: row.billingNotifiedAt?.toISOString() ?? null, legendProcessedAt: row.legendProcessedAt?.toISOString() ?? null, restoredAt: row.restoredAt?.toISOString() ?? null }))} />
      {data.pages > 1 ? <LinkPagination label="Cancellation pages" page={data.page} totalItems={data.total} pageSize={data.pageSize} pathname="/cancellations" query={view === "awaiting" ? {} : { view }} /> : null}
    </section>
  </div>;
}
