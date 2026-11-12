import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { addDaysIso, formatDateRange, formatDateTime } from "@/lib/format";
import { BLOCK_STATE_META, blocksPage, StartBlockDialog } from "@/modules/staffing/features/blocks";

export const metadata: Metadata = { title: "Rota blocks" };

const TONE = { draft: "orange", overdue: "red", published: "green" } as const;

function untilText(deadline: Date, now: Date) {
  const hours = Math.round((deadline.getTime() - now.getTime()) / 3_600_000);
  if (hours < 0) return `${Math.abs(Math.round(hours / 24))} days overdue`;
  return hours < 48 ? `in ${hours} hours` : `in ${Math.round(hours / 24)} days`;
}

/** Rota blocks at a site (BR-2): the next publish deadline, starting a block, and every block. */
export default async function StaffingBlocksPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const data = await blocksPage((await searchParams).site);
  if (!data) return <PageShell header={<PageHeader title="Rota blocks" />}><EmptyState title="No sites" hint="Staffing covers the sites your role works at." /></PageShell>;
  const { site, blocks, next, upcoming } = data;
  const now = new Date();
  const mondays = [0, 14, 28].map((d) => addDaysIso(next.startsOn, d)).filter((m) => !blocks.some((b) => b.startsOn === m));
  const due = upcoming ?? next;
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Rota blocks" description={`Two weeks at a time at ${site.name}, published every second Friday four weeks ahead. Contracted hours first; preferences guide, never limit.`}
      actions={site.supervise && mondays.length ? <StartBlockDialog siteId={site.id} siteName={site.name} mondays={mondays} /> : undefined} />}>
      {due ? (
        <Notice tone={due.state === "overdue" ? "error" : "info"} title={`Next to publish: ${formatDateRange(due.startsOn, addDaysIso(due.startsOn, 13))}`}
          description={`Due ${formatDateTime(due.deadline)}, ${untilText(due.deadline, now)}.${upcoming ? "" : " Not started yet."}`} />
      ) : null}
      <RecordSection id="stf-blocks-h" title="Blocks" aside={blocks.length ? <p>{blocks.length}</p> : null}>
        {blocks.length === 0 ? <div className="pc-list"><EmptyState compact icon="calendarRange" title="No blocks yet" hint={site.supervise ? "Add the weekly slots under Set up, then start a block." : "The pool deck supervisor builds the blocks."} /></div> : (
          <ul className="pc-list">
            {blocks.map((b) => (
              <li key={b.id}>
                <Link href={`/staffing/blocks/${b.id}`} className="pc-row">
                  <span className="pc-tile-icon" data-tone={TONE[b.state]} aria-hidden="true"><CalendarRange /></span>
                  <span className="pc-row-body">
                    <span className="pc-row-title">{formatDateRange(b.startsOn, b.endsOn)}</span>
                    <span className="pc-row-hint">{b.state === "published" ? `${b.acknowledged} of ${b.acks} acknowledged` : `Publish by ${formatDateTime(b.deadline)}`}</span>
                  </span>
                  <span className="pc-row-trail">
                    <span className="text-sm tabular-nums">{b.filled} of {b.places} filled</span>
                    <Tag meta={BLOCK_STATE_META[b.state]} />
                    <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>
    </PageShell>
  );
}
