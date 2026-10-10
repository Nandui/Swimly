import type { ReactNode } from "react";
import { ChevronDown, Mail, Phone } from "lucide-react";
import { SearchField } from "@/components/ui-kit/search-field";
import { Item, ItemGroup } from "@/components/shadcn/item";
import { CollapsibleTrigger, CollapsibleContent } from "@/components/shadcn/collapsible";
import { QueueDisclosure } from "@/modules/activities/shared/enrolment/components/queue-disclosure";
import { CONTACT_CHANNELS, CONTACT_OUTCOMES, type FollowUpSummary } from "@/modules/activities/shared/enrolment/follow-up";
import { formatDate, parseDateOnly, plural, today } from "@/lib/format";
import { buttonVariants } from "@/components/shadcn/button";
import { Tag } from "@/components/ui-kit/tag";
import { FOLLOW_UP_META } from "@/modules/activities/shared/enrolment/constants";
import { PageHeader } from "@/components/ui-kit/page-header";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { AwaitingNavigation } from "@/modules/activities/features/enrolment/components/awaiting-navigation";

/** One list panel (V2Awaiting): the two queues with counts beside the search, the caption, the
 *  rows and the pager. */
export function AwaitingQueue({ view, total, q, counts, page, pageSize, children }: {
  view: "enrolment" | "moves"; total: number; q: string; counts?: { enrolment: number; moves: number }; page: number; pageSize: number; children: ReactNode;
}) {
  const moves = view === "moves";
  return <div className="min-w-0 flex flex-col gap-6">
    <PageHeader title="Awaiting enrolment" description="Select a swimmer to arrange a class or update their follow-up" />
    <section className="pc-panel" aria-label={moves ? "Move queue" : "Enrolment queue"}>
      <div className="min-w-0 flex flex-wrap items-end gap-3">
        <AwaitingNavigation active={view} q={q} counts={counts} />
        <form action="/awaiting-enrolment" className="min-w-0 flex-[1_1_18rem] md:max-w-md" role="search">
          {moves && <input type="hidden" name="view" value="moves" />}
          <SearchField id="awaiting-swimmer-search" label="Find a swimmer" defaultValue={q} placeholder="Name or member number" maxLength={100} clearHref={moves ? "/awaiting-enrolment?view=moves" : "/awaiting-enrolment"} />
        </form>
      </div>
      <p className="text-xs text-ui-muted-foreground tabular-nums" role="status">{moves ? plural(total, "move") : plural(total, "follow-up")}{q ? ` matching “${q}”` : ""} · Oldest first</p>
      {children}
      <LinkPagination label={moves ? "Awaiting moves pages" : "Awaiting enrolment pages"} page={page} totalItems={total} pageSize={pageSize} pathname="/awaiting-enrolment" query={{ ...(moves ? { view: "moves" } : {}), ...(q ? { q } : {}) }} />
    </section>
  </div>;
}

export function QueueList({ children }: { children: ReactNode }) {
  return <ItemGroup>{children}</ItemGroup>;
}

/** "Overdue · 28 Sep" as a red tag once the follow-up date has passed, else a caption. */
function NextContact({ on }: { on: string }) {
  const date = formatDate(parseDateOnly(on));
  return on < today() ? <Tag meta={FOLLOW_UP_META.overdue} label={`Overdue · ${date}`} /> : <span className="block text-xs text-ui-muted-foreground">Follow up · {date}</span>;
}

export function QueueRow({ name, description, status, nextContactOn, contactSummary, identity, placement, followUp }: { name: string; description: string; status: ReactNode; nextContactOn?: string; contactSummary?: FollowUpSummary; identity: ReactNode; placement: ReactNode; followUp: ReactNode }) {
  const latest = contactSummary?.latest;
  // The row is a white bordered row from the list theme (poolside.css); the open one takes the
  // primary edge there too.
  return <Item role="listitem" aria-label={name} className="block min-w-0 overflow-hidden p-0">
    <QueueDisclosure>
      <CollapsibleTrigger className="flex min-h-11 w-full cursor-pointer items-center gap-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ui-ring" aria-label={`View details for ${name}`}>
        <span className="grid min-w-0 flex-1 gap-3 lg:grid-cols-2 lg:gap-6">
          <span className="min-w-0 flex flex-col items-start gap-1"><span className="block font-semibold">{name}</span><span className="block text-xs text-ui-muted-foreground">{description}</span>{nextContactOn ? <NextContact on={nextContactOn} /> : null}</span>
          <span className="min-w-0 flex flex-col gap-1">{latest ? <>
            <span className="block font-semibold">{CONTACT_OUTCOMES[latest.outcome].label} · {formatDate(parseDateOnly(latest.occurredOn))}</span>
            <span className="line-clamp-2 break-words text-xs text-ui-muted-foreground">{latest.note}{latest.note ? " · " : ""}{CONTACT_CHANNELS[latest.channel]} · {latest.actorName}</span>
          </> : <span className="block text-xs text-ui-muted-foreground">No contact or notes recorded</span>}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">{status}<span aria-hidden="true" className={buttonVariants({ variant: "outline" })}><span className="group-data-[state=open]/record:hidden">View</span><span className="hidden group-data-[state=open]/record:inline">Close</span><ChevronDown className="group-data-[state=open]/record:rotate-180" /></span></span>
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="mt-3 grid min-w-0 grid-cols-1 gap-6 border-t border-ui-border pt-4 data-[state=closed]:hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <div className="min-w-0 flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-ui-muted-foreground">Class placement</h3>{placement}<div className="min-w-0 flex flex-col gap-3 rounded-ui-lg border border-ui-border p-4">{identity}</div>
    </div>
    <div className="min-w-0 flex flex-col gap-4">
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
    {student.contactPhone && <a className={link} href={`tel:${student.contactPhone.replace(/[^+\d]/g, "")}`}><Phone aria-hidden="true" className="size-4 shrink-0" /><span className="break-all tabular-nums">{student.contactPhone}</span></a>}
    {student.contactEmail && <a className={link} href={`mailto:${student.contactEmail}`}><Mail aria-hidden="true" className="size-4 shrink-0" /><span className="break-all">{student.contactEmail}</span></a>}
    {!student.contactPhone && !student.contactEmail && <p className="mt-1 text-ui-muted-foreground">No phone or email recorded</p>}
  </div>;
}

