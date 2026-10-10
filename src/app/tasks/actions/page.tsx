import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ACTION_STATUS_META, RaiseAction, ReopenAction, ResolveAction, taskActions } from "@/modules/tasks/features/follow-ups";
import { formatDate, formatDayMonth, today } from "@/lib/format";

export const metadata: Metadata = { title: "Actions" };

/** A site's follow-up actions: what still needs putting right, the oldest needed first, then
 *  the latest resolved with what was done. Reviewers resolve them. */
export default async function TaskActionsPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const data = await taskActions((await searchParams).site);
  if (!data.site) {
    return (
      <>
        <PageHeader title="Actions" />
        <EmptyState as="h2" icon="building" title="No sites to show" hint="Your role does not do tasks at a site yet." />
      </>
    );
  }
  const { site, open, resolved, actionTemplates } = data;
  const day = today();
  return (
    <>
      <PageHeader
        title={`Actions: ${site.name}`}
        description="Close the loop: follow-ups raised from tasks, or on their own, what needs putting right and how it was."
        actions={<RaiseAction siteId={site.id} variant="default" templates={actionTemplates} />}
      />
      <section className="pc-panel" aria-labelledby="actions-open">
        <div className="pc-panel-head"><h2 id="actions-open">Open <span className="text-ui-muted-foreground tabular-nums">· {open.length}</span></h2></div>
        {open.length === 0 ? <EmptyState compact icon="clipboardCheck" title="Nothing to put right" /> : (
          <ul className="pc-rows">
            {open.map((a) => {
              const late = !!a.dueOn && a.dueOn.toISOString().slice(0, 10) < day;
              return (
                <li key={a.id} className="pc-row">
                  <span className="pc-row-body">
                    <span className="pc-row-title">{a.title}</span>
                    <span className="pc-row-hint">{[
                      a.from ? <Link key="from" href={`/tasks/${a.from.id}`} className="underline underline-offset-4">{a.from.title}, {formatDayMonth(a.from.date)}</Link> : "Raised on its own",
                      `by ${a.raisedByName} on ${formatDate(a.createdAt)}`, a.dueOn ? `needed by ${formatDate(a.dueOn)}` : null,
                    ].filter(Boolean).map((part, i) => <span key={i}>{i ? " · " : ""}{part}</span>)}</span>
                    {a.followUpTaskId ? <Link href={`/tasks/${a.followUpTaskId}`} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Open its follow-up task</Link> : null}
                  </span>
                  <span className="pc-row-trail">
                    <Tag meta={ACTION_STATUS_META[late ? "overdue" : "open"]} />
                    {site.review ? <ResolveAction id={a.id} title={a.title} /> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="pc-panel" aria-labelledby="actions-resolved">
        <div className="pc-panel-head"><div className="flex flex-col gap-1"><h2 id="actions-resolved">Resolved</h2><p className="pc-row-hint">The latest 30.</p></div></div>
        {resolved.length === 0 ? <EmptyState compact icon="clipboardList" title="None resolved yet" /> : (
          <ul className="pc-rows">
            {resolved.map((a) => (
              <li key={a.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{a.title}</span>
                  <span className="pc-row-hint">{[a.from ? `${a.from.title}, ${formatDayMonth(a.from.date)}` : null, `${a.resolvedByName ?? "Someone"} on ${a.resolvedAt ? formatDate(a.resolvedAt) : ""}: ${a.resolution}`].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="pc-row-trail">
                  <Tag meta={ACTION_STATUS_META.resolved} />
                  {site.review ? <ReopenAction id={a.id} /> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
