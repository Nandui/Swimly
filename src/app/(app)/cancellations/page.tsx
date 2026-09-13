import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { BillingList } from "@/components/duty/billing-list";
import { screenPage } from "@/lib/page-guards";
import { can, canSee } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { getBillingCancellations } from "@/lib/cancellations/data";

export const metadata: Metadata = { title: "Cancelled classes" };
export default async function CancellationsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const session = await screenPage("cancellations"), params = await searchParams;
  const notified = params.status === "notified";
  const requested = Number(params.page), page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  const [data, { club }] = await Promise.all([getBillingCancellations(notified, page), getCurrentClub()]);
  const href = (nextPage: number) => `/cancellations?status=${notified ? "notified" : "pending"}&page=${nextPage}`;
  return <div className="flex min-w-0 flex-col gap-6"><header className="flex flex-wrap items-start justify-between gap-4"><div className="space-y-1"><h1 className="text-2xl font-semibold tracking-tight">Cancelled classes</h1><p className="text-sm text-ui-muted-foreground">{club.name} · Billing follow-up across all dates</p><p className="max-w-2xl text-sm text-ui-muted-foreground">Review the affected swimmers, notify billing using your usual process, then record the handoff here.</p></div>{canSee(session, "duty") ? <Button asChild variant="outline" className="min-h-11"><Link href="/duty">Today’s classes</Link></Button> : null}</header>
    <nav aria-label="Billing follow-up status" className="flex flex-wrap gap-2"><Button asChild variant={notified ? "ghost" : "secondary"} className="min-h-11"><Link href="/cancellations" aria-current={!notified ? "page" : undefined}>Awaiting billing ({data.pending})</Link></Button><Button asChild variant={notified ? "secondary" : "ghost"} className="min-h-11"><Link href="/cancellations?status=notified" aria-current={notified ? "page" : undefined}>Billing notified</Link></Button></nav>
    <BillingList canNotify={can(session, "billing.notify")} notified={notified} rows={data.rows.map(row => ({ ...row, date: row.date.toISOString().slice(0, 10), cancelledAt: row.cancelledAt.toISOString(), billingNotifiedAt: row.billingNotifiedAt?.toISOString() ?? null }))} />
    {data.pages > 1 ? <nav aria-label="Cancellation pages" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-ui-muted-foreground">Page {data.page} of {data.pages} · {data.total} cancellations</p><div className="flex gap-2">{data.page > 1 ? <Button asChild variant="outline" className="min-h-11"><Link href={href(data.page - 1)}>Previous</Link></Button> : null}{data.page < data.pages ? <Button asChild variant="outline" className="min-h-11"><Link href={href(data.page + 1)}>Next</Link></Button> : null}</div></nav> : null}
  </div>;
}
