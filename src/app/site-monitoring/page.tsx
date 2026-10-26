import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { CloseAction, MONITORING_STATUS_META, monitoringActions, readingLine, ReopenAction } from "@/modules/site-monitoring/features/actions";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Actions" };

/** What managers act on at their sites: every reading recorded out of range on a task, the
 *  oldest first, then the latest closed with what was done. */
export default async function SiteMonitoringPage() {
  const { open, closed } = await monitoringActions();
  return (
    <PageShell spacing="roomy" header={<PageHeader
      title="Site Monitoring"
      description="When a task is completed with a reading out of range, it lands here for the site's managers. Check it was put right, then close it by saying what was done."
    />}>
      <RecordSection id="monitoring-open" title="Needs action" aside={open.length ? <p>{open.length}</p> : null}>
        {open.length === 0 ? <EmptyState compact icon="clipboardCheck" title="Nothing to act on" hint="Readings out of range show here as soon as a task is completed." /> : (
          <ul className="pc-list">
            {open.map((a) => (
              <li key={a.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{readingLine(a)} <span className="text-ui-muted-foreground font-normal">· allowed {a.allowed}{a.unit ? ` ${a.unit}` : ""}</span></span>
                  <span className="pc-row-hint">{a.title} at {a.site.name} · recorded by {a.recordedByName}, {formatDateTime(a.recordedAt)}</span>
                  {a.guidance ? <span className="pc-row-hint">The task says: {a.guidance}</span> : null}
                  <Link href={a.sourceHref} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">See the task</Link>
                </span>
                <span className="pc-row-trail">
                  <Tag meta={MONITORING_STATUS_META.open} />
                  {a.act ? <CloseAction id={a.id} title={`${readingLine(a)} on ${a.title} at ${a.site.name}`} /> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>
      <RecordSection id="monitoring-closed" title="Closed" note="The latest 30.">
        {closed.length === 0 ? <EmptyState compact icon="clipboardList" title="None closed yet" /> : (
          <ul className="pc-list">
            {closed.map((a) => (
              <li key={a.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{readingLine(a)} <span className="text-ui-muted-foreground font-normal">· {a.title} at {a.site.name}</span></span>
                  <span className="pc-row-hint">{a.closedByName ?? "Someone"}{a.closedAt ? `, ${formatDateTime(a.closedAt)}` : ""}: {a.resolution}</span>
                </span>
                <span className="pc-row-trail">
                  <Tag meta={MONITORING_STATUS_META.closed} />
                  {a.act ? <ReopenAction id={a.id} /> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>
    </PageShell>
  );
}
