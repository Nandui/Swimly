import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { BillingList } from "@/modules/activities/components/duty/billing-list";
import { screenPage } from "@/lib/page-guards";
import { can, canSee } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { getBillingCancellations } from "@/modules/activities/lib/cancellations/data";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { ClipboardList, FileSpreadsheet } from "lucide-react";

export const metadata: Metadata = { title: "Cancelled classes" };
export default async function CancellationsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const session = await screenPage("cancellations"), params = await searchParams;
  const notified = params.status === "notified";
  const requested = Number(params.page), page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  const [data, { club }] = await Promise.all([getBillingCancellations(notified, page), getCurrentClub()]);
  return <div className="flex min-w-0 flex-col gap-6">
    <PageHeader title="Cancelled classes"
      description={`${club.name} · Billing follow-up across all dates. Review the affected swimmers, notify billing using your usual process, then record the handoff here.`}
      actions={<>
        {data.total ? <Button asChild variant="outline"><a href={`/cancellations/export${notified ? "?status=notified" : ""}`} download
          title="Every cancellation in this view, one row for each affected member, in Legend's bulk update template">
          <FileSpreadsheet aria-hidden="true" />Export for Legend</a></Button> : null}
        {canSee(session, "duty") ? <Button asChild variant="outline"><Link href="/duty"><ClipboardList aria-hidden="true" />Today’s classes</Link></Button> : null}
      </>} />
    <section className="pc-panel" aria-label="Billing follow-up">
      <SegmentedLinks label="Billing follow-up status" items={[{ href: "/cancellations", label: "Awaiting billing", count: data.pending, current: !notified }, { href: "/cancellations?status=notified", label: "Billing notified", current: notified }]} />
      <BillingList canNotify={can(session, "billing.notify")} notified={notified} rows={data.rows.map(row => ({ ...row, date: row.date.toISOString().slice(0, 10), cancelledAt: row.cancelledAt.toISOString(), billingNotifiedAt: row.billingNotifiedAt?.toISOString() ?? null }))} />
      {data.pages > 1 ? <LinkPagination label="Cancellation pages" page={data.page} totalItems={data.total} pageSize={data.pageSize} pathname="/cancellations" query={notified ? { status: "notified" } : {}} /> : null}
    </section>
  </div>;
}
