"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Tag } from "@/components/ui-kit/tag";
import { RefundInput, RefundSelect } from "@/components/refunds/fields";
import { refundStatuses, refundServices, refundNumber, euros } from "@/lib/refunds/types";
import { formatDate } from "@/lib/format";
import type { listRefunds } from "@/lib/refunds/data";

export function RefundQueue({ data }: { data: Awaited<ReturnType<typeof listRefunds>> }) {
  const router = useRouter(), [filters, setFilters] = useState(data.filters);
  const url = (page = 1) => { const query = new URLSearchParams(); for (const [key, value] of Object.entries(filters)) if (key !== "page" && value && value !== "all") query.set(key, value); if (filters.status === "all") query.set("status", "all"); query.set("page", String(page)); return `/refunds?${query}`; };
  const set = (key: keyof typeof filters) => (value: string) => setFilters(previous => ({ ...previous, [key]: value }));
  const people = [...new Map(data.people.map(person => [person.creatorId, { value: person.creatorId, label: person.creatorName }])).values()];
  const handlers = [...new Map(data.people.filter(person => person.handlerId).map(person => [person.handlerId!, { value: person.handlerId!, label: person.handlerName! }])).values()];
  const count = (keys: string[]) => keys.reduce((sum, key) => sum + (data.counts[key] || 0), 0);
  return <div className="space-y-6">
    <div className="refund-heading"><div className="space-y-2"><h1 className="text-2xl font-semibold tracking-tight">Refund requests</h1><p className="text-sm text-ui-muted-foreground">Reception and finance, working together across LeisureWorld.</p></div>{data.who.request && <Button asChild className="min-h-11"><Link href="/refunds/new"><Plus aria-hidden="true" />New request</Link></Button>}</div>
    <dl className="refund-summary grid grid-cols-2 gap-6 sm:grid-cols-4">
      {[['Awaiting review', count(['SUBMITTED', 'IN_REVIEW'])], ['Needs information', count(['NEEDS_INFORMATION'])], ['Awaiting payment', count(['APPROVED'])], ['Refunded', count(['REFUNDED'])]].map(([label, value]) => <div key={label} className="space-y-2"><dt className="text-xs text-ui-muted-foreground">{label}</dt><dd className="text-2xl font-semibold tabular-nums">{value}</dd></div>)}
    </dl><p className="refund-totals-note text-xs text-ui-muted-foreground">Totals follow the search, site, service and staff filters, across all statuses.</p>
    <form onSubmit={event => { event.preventDefault(); router.push(url()); }} className="refund-filters space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <RefundInput id="refund-search" label="Find a request" placeholder="Customer, member, payment or RF number" value={filters.q || ""} onChange={event => set('q')(event.target.value)} />
        <RefundSelect id="filter-site" label="Site" value={filters.site || "all"} onChange={set('site')} options={[{ value: 'all', label: 'All sites' }, ...data.sites.map(site => ({ value: site.id, label: site.name }))]} />
        <RefundSelect id="filter-status" label="Status" value={filters.status || 'open'} onChange={set('status')} options={[{ value: 'open', label: 'Open requests' }, { value: 'actionable', label: 'Needs my team’s action' }, { value: 'all', label: 'All statuses' }, ...Object.entries(refundStatuses).map(([value, meta]) => ({ value, label: meta.label }))]} />
        <RefundSelect id="filter-service" label="Service" value={filters.service || 'all'} onChange={set('service')} options={[{ value: 'all', label: 'All services' }, ...Object.entries(refundServices).map(([value, label]) => ({ value, label }))]} />
        <RefundSelect id="filter-creator" label="Submitted by" value={filters.creator || 'all'} onChange={set('creator')} options={[{ value: 'all', label: 'All staff' }, ...people]} />
        <RefundSelect id="filter-handler" label="Finance handler" value={filters.handler || 'all'} onChange={set('handler')} options={[{ value: 'all', label: 'All handlers' }, { value: 'unassigned', label: 'Unassigned' }, ...handlers]} />
      </div><div className="flex gap-2"><Button className="min-h-11" type="submit"><Search aria-hidden="true" />Apply filters</Button><Button asChild variant="ghost" className="min-h-11"><Link href="/refunds" onClick={() => setFilters({ status: data.who.review || data.who.process ? 'actionable' : 'open' })}>Reset</Link></Button></div>
    </form>
    <div className="refund-results space-y-3"><p className="text-sm text-ui-muted-foreground">{data.total} {data.total === 1 ? 'request' : 'requests'}</p>
      {data.rows.length === 0 ? <div className="rounded-ui-xl border border-dashed border-ui-border p-8 text-center"><h2 className="font-semibold">No requests to show</h2><p className="mt-2 text-sm text-ui-muted-foreground">Try changing the filters, or create a request for a customer.</p></div> : <ul className="divide-y divide-ui-border overflow-hidden rounded-ui-xl border border-ui-border bg-ui-card">{data.rows.map(row => <li key={row.id}><Link href={`/refunds/${row.id}`} className="refund-row flex min-h-24 flex-wrap items-center justify-between gap-4 p-4 hover:bg-ui-accent focus-visible:outline-2 focus-visible:outline-ui-ring sm:p-5"><div className="min-w-0 flex-1 space-y-2"><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-ui-muted-foreground">{refundNumber(row.number)}</span><Tag color={refundStatuses[row.status].color}>{refundStatuses[row.status].label}</Tag></div><p className="break-words font-semibold">{row.customerName || 'Unnamed draft'}</p><p className="text-xs leading-relaxed text-ui-muted-foreground">{row.clubName} · {refundServices[row.service]} · {row.creatorName}</p><p className="text-xs text-ui-muted-foreground">{row.handlerName ? `Finance: ${row.handlerName}` : 'Finance: unassigned'} · {formatDate(new Date(row.submittedAt || row.createdAt))}</p></div><div className="flex items-center gap-4"><div className="text-right"><p className="font-semibold tabular-nums">{euros(row.approvedCents ?? row.requestedCents)}</p><p className="mt-1 text-xs text-ui-muted-foreground">{row.approvedCents !== null ? 'Approved' : 'Requested'}</p></div><ArrowRight className="size-4" aria-hidden="true" /></div></Link></li>)}</ul>}
    </div>
    {data.pages > 1 && <nav aria-label="Request pages" className="flex items-center justify-between gap-3">{data.page === 1 ? <Button disabled variant="outline" className="min-h-11">Previous</Button> : <Button asChild variant="outline" className="min-h-11"><Link href={url(data.page - 1)}>Previous</Link></Button>}<span className="text-sm">Page {data.page} of {data.pages}</span>{data.page === data.pages ? <Button disabled variant="outline" className="min-h-11">Next</Button> : <Button asChild variant="outline" className="min-h-11"><Link href={url(data.page + 1)}>Next</Link></Button>}</nav>}
  </div>;
}
