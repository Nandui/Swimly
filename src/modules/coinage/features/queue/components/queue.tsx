"use client";
import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronRight, Coins, Inbox, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { SearchField } from "@/components/ui-kit/search-field";
import { Tag } from "@/components/ui-kit/tag";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { coinageListView, coinageNumber, coinageStatuses, euros, type CoinageStatus } from "@/modules/coinage/shared/types";
import { formatDate, parseDateOnly, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { listCoinage } from "@/modules/coinage/features/queue/server/list";

type Data = Awaited<ReturnType<typeof listCoinage>>;
type Option = { value: string; label: string };
const KEPT = ["q", "site", "status", "creator", "handler"] as const;
const ALL = "all";
/** The status picker's views; each is a set of statuses (listCoinage). */
const VIEWS: Option[] = [
  { value: "open", label: "Open requests" }, { value: "actionable", label: "Needs my team’s action" },
  { value: "review", label: "Awaiting review" }, { value: "all", label: "All statuses" },
];
/** The follow-up queues as figure tiles. Awaiting review is a view (submitted and in review). */
const TILES = [
  { status: "review", label: "Awaiting review", hint: "Submitted and in review", icon: Inbox, counts: ["SUBMITTED", "IN_REVIEW"] },
  ...(["NEEDS_INFORMATION", "APPROVED", "ORDERED"] as const).map(status => ({
    status, label: coinageStatuses[status].label, icon: coinageStatuses[status].icon, counts: [status],
    hint: { NEEDS_INFORMATION: "Sent back to the desk", APPROVED: "Approved, not ordered yet", ORDERED: "Order recorded" }[status],
  })),
];
const EMPTY: Record<string, string> = {
  review: "Nothing is waiting for review", SUBMITTED: "Nothing is waiting for review", IN_REVIEW: "Nothing is in review",
  actionable: "Nothing is waiting for your team", NEEDS_INFORMATION: "Nothing needs more information",
  APPROVED: "No approved requests waiting to be ordered", ORDERED: "No orders recorded yet", DRAFT: "No drafts",
  DECLINED: "No declined requests", WITHDRAWN: "No withdrawn requests",
};

export function CoinageQueue({ data }: { data: Data }) {
  const router = useRouter(), [pending, startNavigation] = useTransition();
  const f = data.filters as Record<(typeof KEPT)[number], string | undefined> & { status: string }, who = data.who;
  const view = coinageListView({ get: key => f[key as (typeof KEPT)[number]] ?? null }, who.id);
  const defaultStatus = who.review || who.process ? "actionable" : "open";
  // Each link keeps the other filters and drops the page, so a tile's count is its list.
  const query = (changes: Partial<Record<(typeof KEPT)[number], string | null>> = {}) => {
    const params: Record<string, string> = {};
    for (const key of KEPT) { const value = key in changes ? changes[key] : f[key]; if (value) params[key] = value; }
    return params;
  };
  const href = (changes: Partial<Record<(typeof KEPT)[number], string | null>>) => { const params = new URLSearchParams(query(changes)); return params.size ? `/coinage?${params}` : "/coinage"; };
  const pick = (key: (typeof KEPT)[number]) => (value: string) =>
    startNavigation(() => router.push(href({ [key]: key !== "status" && value === ALL ? null : value }), { scroll: false }));
  const viewHref = view === "mine" ? `/coinage?creator=${encodeURIComponent(who.id)}&status=all` : view === "drafts" ? "/coinage?status=DRAFT" : "/coinage";
  const creatorFilter = view !== "mine" && f.creator ? 1 : 0;
  const filterCount = [f.site, f.handler, view === "requests" && f.status !== defaultStatus].filter(Boolean).length + creatorFilter;
  const filtering = filterCount > 0 || Boolean(f.q?.trim());
  const [phoneOpen, setPhoneOpen] = useState(false);
  const people = [...new Map(data.people.map(person => [person.creatorId, { value: person.creatorId, label: person.creatorName }])).values()];
  const handlers = [...new Map(data.people.filter(person => person.handlerId).map(person => [person.handlerId!, { value: person.handlerId!, label: person.handlerName! }])).values()];
  const count = (keys: string[]) => keys.reduce((sum, key) => sum + (data.counts[key] || 0), 0);
  const statusLabel = { open: "Open requests", actionable: "Needs my team’s action", review: "Awaiting review", all: "All requests" }[f.status] ?? coinageStatuses[f.status as CoinageStatus]?.label ?? "Requests";
  const what = view === "drafts" ? "Your drafts" : view === "mine" ? (f.status === "all" ? "Requests you made" : `${statusLabel}, made by you`) : statusLabel;
  const site = data.sites.find(item => item.id === f.site)?.name ?? "All sites";
  const title = view === "mine" ? "My requests" : view === "drafts" ? "My drafts" : "Coinage requests";
  const create = who.request ? <Button asChild><Link href="/coinage/new"><Coins aria-hidden="true" />Request coinage</Link></Button> : null;
  return <PageShell header={<PageHeader title={title} description={`${what} · ${site}`} actions={create} />}>
    <ul className="pc-stats" aria-label="Follow-up queues">
      {TILES.map(tile => {
        const value = count(tile.counts), Icon = tile.icon;
        return <li key={tile.status} className="flex">
          <Link href={href({ status: tile.status })} className="pc-stat w-full" aria-current={f.status === tile.status ? "true" : undefined}>
            <span className="pc-tile-icon"><Icon aria-hidden="true" /></span>
            <span><span className={cn("pc-stat-figure block", !value && "text-ui-muted-foreground")}>{value}</span><span className="block font-semibold">{tile.label}</span></span>
            <span className="text-xs text-ui-muted-foreground max-sm:hidden">{tile.hint}</span>
          </Link>
        </li>;
      })}
    </ul>
    <section className="pc-panel" aria-label="Requests" aria-busy={pending}>
      <Form action="/coinage" role="search" aria-label="Find a coinage request" className="min-w-0">
        {KEPT.map(key => key !== "q" && f[key] ? <input key={key} type="hidden" name={key} value={f[key]} /> : null)}
        <SearchField id="coinage-search" label="Find a request" defaultValue={f.q ?? ""} placeholder="Till, name, order reference or CO number" maxLength={200} clearHref={href({ q: null })} />
      </Form>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="sm:hidden" aria-expanded={phoneOpen} aria-controls="coinage-pickers" onClick={() => setPhoneOpen(open => !open)}><SlidersHorizontal aria-hidden="true" />Filters{filterCount ? ` (${filterCount})` : ""}</Button>
        <div id="coinage-pickers" className={cn("contents", !phoneOpen && "max-sm:hidden")}>
          <Picker label="Site" value={f.site || ALL} disabled={pending} onPick={pick("site")} groups={[{ title: "", options: [{ value: ALL, label: "All sites" }, ...data.sites.map(item => ({ value: item.id, label: item.name }))] }]} />
          <Picker label="Status" value={f.status} disabled={pending} onPick={pick("status")} groups={[{ title: "Views", options: VIEWS }, { title: "Statuses", options: Object.entries(coinageStatuses).map(([value, meta]) => ({ value, label: meta.label })) }]} />
          <Picker label="Handler" value={f.handler || ALL} disabled={pending} onPick={pick("handler")} groups={[{ title: "", options: [{ value: ALL, label: "All handlers" }, { value: "unassigned", label: "Unassigned" }, ...handlers] }]} />
          <Picker label="Requested by" value={f.creator || ALL} disabled={pending} onPick={pick("creator")} groups={[{ title: "", options: [{ value: ALL, label: "All staff" }, ...people] }]} />
        </div>
        {filtering ? <Button asChild variant="ghost"><Link href={viewHref}>Clear filters</Link></Button> : null}
      </div>
      {data.total ? <p className="text-xs text-ui-muted-foreground tabular-nums" aria-live="polite" aria-atomic="true">{plural(data.total, filtering ? "matching request" : "request", filtering ? "matching requests" : "requests")}</p> : null}
      {data.rows.length === 0
        ? <EmptyState as="h2" role="status" icon="receipt" title={EMPTY[f.status] ?? (view === "mine" ? "You haven’t requested coinage yet" : "No requests to show")} hint={filtering ? "Try changing the filters." : undefined} action={!filtering && (view !== "requests" || f.status === "open") ? create : undefined} />
        : <ul className="pc-rows">{data.rows.map(row => <li key={row.id}>
          <Link href={`/coinage/${row.id}`} className="pc-row">
            <span className="pc-row-body"><span className="pc-row-title break-words">{row.forWhom || "Unnamed draft"}</span><span className="pc-row-hint">{coinageNumber(row.number)} · {row.clubName} · {row.neededBy ? `Needed by ${formatDate(parseDateOnly(row.neededBy))}` : formatDate(new Date(row.submittedAt || row.createdAt))}</span></span>
            <span className="pc-row-trail"><span className="font-semibold tabular-nums">{euros(row.totalCents)}</span><Tag meta={coinageStatuses[row.status]} /><ChevronRight aria-hidden="true" className="pc-row-chevron" /></span>
          </Link>
        </li>)}</ul>}
      <LinkPagination label="Request pages" page={data.page} pageCount={data.pages} pathname="/coinage" query={query()} />
    </section>
  </PageShell>;
}

/** A filter as a pill that applies on change: its name, then the chosen value. */
function Picker({ label, value, groups, onPick, disabled }: { label: string; value: string; groups: { title: string; options: Option[] }[]; onPick: (value: string) => void; disabled: boolean }) {
  const chosen = groups.flatMap(group => group.options).find(option => option.value === value)?.label ?? "";
  return <Select value={value} onValueChange={onPick} disabled={disabled}>
    <SelectTrigger aria-label={`${label}: ${chosen}`} className="max-w-full min-w-0 gap-1.5">
      <span className="text-ui-muted-foreground">{label}</span><SelectValue />
    </SelectTrigger>
    <SelectContent>
      {groups.map(group => <SelectGroup key={group.title || label}>
        {group.title ? <SelectLabel>{group.title}</SelectLabel> : null}
        {group.options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectGroup>)}
    </SelectContent>
  </Select>;
}
