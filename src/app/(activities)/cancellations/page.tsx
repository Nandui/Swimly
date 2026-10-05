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

export const metadata: Metadata = { title: "Cancelled classes" };
export default async function CancellationsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const session = await screenPage("cancellations"), params = await searchParams;
  const notified = params.status === "notified";
  const requested = Number(params.page), page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  const [data, { club }] = await Promise.all([getBillingCancellations(notified, page), getCurrentClub()]);
  return <div className="flex min-w-0 flex-col gap-6"><header className="flex flex-wrap items-start justify-between gap-4"><div className="space-y-1"><h1 className="text-2xl font-semibold">Cancelled classes</h1><p className="text-sm text-ui-muted-foreground">{club.name} · Billing follow-up across all dates</p><p className="max-w-2xl text-sm text-ui-muted-foreground">Review the affected swimmers, notify billing using your usual process, then record the handoff here.</p></div>{canSee(session, "duty") ? <Button asChild variant="outline" className="min-h-11"><Link href="/duty">Today’s classes</Link></Button> : null}</header>
    <SegmentedLinks label="Billing follow-up status" items={[{ href: "/cancellations", label: "Awaiting billing", count: data.pending, current: !notified }, { href: "/cancellations?status=notified", label: "Billing notified", current: notified }]} />
    <BillingList canNotify={can(session, "billing.notify")} notified={notified} rows={data.rows.map(row => ({ ...row, date: row.date.toISOString().slice(0, 10), cancelledAt: row.cancelledAt.toISOString(), billingNotifiedAt: row.billingNotifiedAt?.toISOString() ?? null }))} />
    <LinkPagination label="Cancellation pages" page={data.page} pageCount={data.pages} pathname="/cancellations" query={notified ? { status: "notified" } : {}} />
  </div>;
}
