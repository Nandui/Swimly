import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown, Mail, Phone, Search } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Item, ItemGroup } from "@/components/shadcn/item";
import { CollapsibleTrigger, CollapsibleContent } from "@/components/shadcn/collapsible";
import { QueueDisclosure } from "./queue-disclosure";
import { CONTACT_CHANNELS, CONTACT_OUTCOMES, type FollowUpSummary } from "@/lib/enrolment/follow-up";
import { formatDate, parseDateOnly } from "@/lib/format";
import { PageHeader } from "@/components/ui-kit/page-header";
import { AwaitingNavigation } from "./awaiting-navigation";

export function AwaitingQueue({ view, total, q, children }: {
  view: "enrolment" | "moves"; total: number; q: string; children: ReactNode;
}) {
  const moves = view === "moves";
  return <div className="min-w-0 space-y-6">
    <PageHeader title="Awaiting enrolment" description="Select a swimmer to arrange a class or update their follow-up." />
    <AwaitingNavigation active={view} />
    <form action="/awaiting-enrolment" className="flex flex-wrap items-end gap-3" role="search">
      {moves && <input type="hidden" name="view" value="moves" />}
      <div className="min-w-0 flex-1 basis-56 space-y-2">
        <Label htmlFor="awaiting-swimmer-search">Find a swimmer</Label>
        <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3 size-4 text-ui-muted-foreground" />
          <Input id="awaiting-swimmer-search" type="search" name="q" defaultValue={q} key={q} placeholder="Name or member number" maxLength={100} className="min-h-11 pl-9" />
        </div>
      </div>
      <Button type="submit" variant="outline" className="min-h-11">Search</Button>
      {q && <Button asChild variant="ghost" className="min-h-11"><Link href={moves ? "/awaiting-enrolment?view=moves" : "/awaiting-enrolment"}>Clear</Link></Button>}
    </form>
    <section className="space-y-4" aria-label={moves ? "Move queue" : "Enrolment queue"}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-ui-muted-foreground" role="status">{total} {moves ? total === 1 ? "move" : "moves" : total === 1 ? "follow-up" : "follow-ups"}{q ? ` matching “${q}”` : ""} · Oldest first</p>
      </div>
      {children}
    </section>
  </div>;
}

export function QueueList({ children }: { children: ReactNode }) {
  return <ItemGroup className="gap-4">{children}</ItemGroup>;
}

export function QueueRow({ name, description, status, nextContact, contactSummary, identity, placement, followUp }: { name: string; description: string; status: ReactNode; nextContact?: string; contactSummary?: FollowUpSummary; identity: ReactNode; placement: ReactNode; followUp: ReactNode }) {
  const latest = contactSummary?.latest;
  return <Item role="listitem" aria-label={name} variant="outline" className="block min-w-0 overflow-hidden rounded-ui-lg bg-ui-background p-0">
    <QueueDisclosure>
      <CollapsibleTrigger className="flex min-h-20 w-full cursor-pointer items-center gap-4 bg-ui-muted/30 p-4 text-left hover:bg-ui-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ui-ring" aria-label={`View details for ${name}`}>
        <span className="grid min-w-0 flex-1 gap-3 lg:grid-cols-2 lg:gap-6">
          <span className="min-w-0 space-y-1"><span className="block font-semibold">{name}</span><span className="block text-sm text-ui-muted-foreground">{description}</span>{nextContact && <span className="block text-xs font-medium">{nextContact}</span>}</span>
          <span className="min-w-0 space-y-1">{latest ? <>
            <span className="block text-xs font-medium">{CONTACT_OUTCOMES[latest.outcome].label} · {formatDate(parseDateOnly(latest.occurredOn))}</span>
            <span className="line-clamp-2 break-words text-sm text-ui-muted-foreground">{latest.note}</span>
            <span className="block text-xs text-ui-muted-foreground">{CONTACT_CHANNELS[latest.channel]} · {latest.actorName}</span>
          </> : <span className="block text-xs text-ui-muted-foreground">No contact or notes recorded</span>}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">{status}<span className="flex items-center gap-2 text-sm text-ui-primary"><span className="group-data-[state=open]/record:hidden">View</span><span className="hidden group-data-[state=open]/record:inline">Close</span><ChevronDown aria-hidden="true" className="size-4 group-data-[state=open]/record:rotate-180" /></span></span>
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="grid min-w-0 grid-cols-1 gap-6 border-t border-ui-border p-4 data-[state=closed]:hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
    <div className="min-w-0 space-y-3">
      <h3 className="font-semibold">Class placement</h3>{placement}<div className="space-y-3 border-t border-ui-border pt-4">{identity}</div>
    </div>
    <div className="min-w-0 space-y-4 border-t border-ui-border pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
      {followUp}
    </div>
      </CollapsibleContent>
    </QueueDisclosure>
  </Item>;
}

export function QueueContact({ student }: { student: { contactName: string | null; contactPhone: string | null; contactEmail: string | null } }) {
  const link = "flex min-h-11 min-w-0 items-center gap-2 rounded-ui-sm text-ui-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ui-ring focus-visible:outline-offset-2";
  return <div className="min-w-0 text-sm">
    <p className="text-xs text-ui-muted-foreground">Family contact</p>
    {student.contactName && <p className="mt-1 break-words">{student.contactName}</p>}
    {student.contactPhone && <a className={link} href={`tel:${student.contactPhone.replace(/[^+\d]/g, "")}`}><Phone aria-hidden="true" className="size-4 shrink-0" /><span className="break-all">{student.contactPhone}</span></a>}
    {student.contactEmail && <a className={link} href={`mailto:${student.contactEmail}`}><Mail aria-hidden="true" className="size-4 shrink-0" /><span className="break-all">{student.contactEmail}</span></a>}
    {!student.contactPhone && !student.contactEmail && <p className="mt-1 text-ui-muted-foreground">No phone or email recorded</p>}
  </div>;
}

export function QueuePagination({ page, pages, q, moves = false }: { page: number; pages: number; q: string; moves?: boolean }) {
  if (pages <= 1) return null;
  const href = (number: number) => `/awaiting-enrolment?${new URLSearchParams({ ...(moves ? { view: "moves" } : {}), ...(q ? { q } : {}), page: String(number) })}`;
  return <nav aria-label={moves ? "Awaiting moves pages" : "Awaiting enrolment pages"} className="flex flex-wrap items-center justify-between gap-3">
    <span className="text-sm text-ui-muted-foreground">Page {page} of {pages}</span><div className="flex gap-2">
      {page > 1 && <Button asChild variant="outline" className="min-h-11"><Link href={href(page - 1)}>Previous</Link></Button>}
      {page < pages && <Button asChild variant="outline" className="min-h-11"><Link href={href(page + 1)}>Next</Link></Button>}
    </div>
  </nav>;
}

