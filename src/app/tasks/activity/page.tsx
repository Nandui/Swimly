import type { Metadata } from "next";
import { Download, History } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { formatDateTime } from "@/lib/format";
import { ACTIVITY_PAGE, taskActivity } from "@/lib/tasks/data";

export const metadata: Metadata = { title: "Activity" };

/** Tasks' history (the prototype's Activity): every change made in Tasks at the sites this person
 *  reviews, and to the templates, newest first. The same entries are in Admin's activity log.
 *  Managers can export everything Tasks keeps as JSON. */
export default async function TaskActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { who, rows, total, page } = await taskActivity(Number((await searchParams).page) || 1);
  const pages = Math.max(1, Math.ceil(total / ACTIVITY_PAGE));
  return (
    <>
      <PageHeader title="Activity history" description="A record of every change made in Tasks: who did what, where and when."
        actions={who.manage ? <Button asChild variant="outline"><a href="/tasks/export.json"><Download aria-hidden="true" />Export everything</a></Button> : undefined} />
      <section className="pc-panel" aria-labelledby="activity-saved">
        <div className="pc-panel-head"><h2 id="activity-saved">Saved changes <span className="text-ui-muted-foreground tabular-nums">· {total}</span></h2></div>
        {rows.length === 0 ? <EmptyState compact icon="scrollText" title="No changes yet" /> : (
          <ul className="pc-rows">
            {rows.map((r) => (
              <li key={r.id} className="pc-row">
                <span className="pc-tile-icon" aria-hidden="true"><History /></span>
                <span className="pc-row-body">
                  <span className="pc-row-title">{r.summary}</span>
                  <span className="pc-row-hint">{[r.actorName, r.siteName, formatDateTime(r.createdAt)].filter(Boolean).join(" · ")}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 ? <LinkPagination label="Activity pages" page={page} totalItems={total} pageSize={ACTIVITY_PAGE} pathname="/tasks/activity" /> : null}
      </section>
    </>
  );
}
