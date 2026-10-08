import type { Metadata } from "next";
import { cache } from "react";
import { Tag } from "@/components/ui-kit/tag";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { TaskStateTag } from "@/components/tasks/status";
import { AddComment, ApproveTask, CantComplete, NotApplicable, RaiseAction, ReopenTask, ResolveAction } from "@/components/tasks/task-dialogs";
import { TaskWork } from "@/components/tasks/task-work";
import Link from "next/link";
import { formatDate, formatDateTime, formatDayMonth, formatWeekday } from "@/lib/format";
import { taskDetail } from "@/lib/tasks/data";
import { ACTION_STATUS_META, PRIORITY_META, clockOf, dayIn } from "@/lib/tasks/rules";

/** One read per request, shared by the page and its tab title. */
const load = cache(taskDetail);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: (await load((await params).id)).task.title };
}

/** One task: what it asks for, done here; its comments and follow-up actions beside it; and
 *  for reviewers, approve, reopen or mark it not applicable. */
export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { task, roles, can, actionTemplates } = await load((await params).id);
  const def = task.definition;
  const isToday = task.date === dayIn(task.timezone);
  const back = `/tasks?${new URLSearchParams({ site: task.siteId, ...(isToday ? {} : { date: task.date }) })}`;
  const closed = task.status !== "open";
  const facts: [string, React.ReactNode][] = [
    ["Site", task.siteName],
    ["Day", `${formatWeekday(task.date)} ${formatDayMonth(task.date)}`],
    ["Time", `${clockOf(task.startsAt, task.timezone)} to ${clockOf(task.dueAt, task.timezone)}`],
    ["For", roles.length ? `${roles.join(", ")}${def.restricted === false ? " (anyone may complete it)" : ""}` : "Everyone at the site"],
    ...(task.addedByName ? [["Added by", task.addedByName] as [string, string]] : []),
    ...(task.completedByName ? [[task.status === "done" ? "Completed by" : "Closed by", task.completedByName] as [string, string]] : []),
    ...(task.approvedByName ? [["Approved by", task.approvedByName] as [string, string]] : []),
  ];
  return (
    <>
      <PageHeader
        back={{ href: back, label: isToday ? "Today" : formatDayMonth(task.date) }}
        title={def.title}
        description={def.description || undefined}
        status={<><TaskStateTag state={task.state} />{def.priority ? <Tag meta={PRIORITY_META} /> : null}</>}
        actions={<>
          {can.work && !closed ? <CantComplete id={task.id} version={task.version} /> : null}
          {can.review && !closed ? <NotApplicable id={task.id} version={task.version} /> : null}
          {can.review && closed ? <ReopenTask id={task.id} version={task.version} /> : null}
          {can.approve ? <ApproveTask id={task.id} version={task.version} /> : null}
        </>}
      />

      <section className="pc-panel" aria-labelledby="task-details">
        <div className="pc-panel-head"><h2 id="task-details">Details</h2></div>
        <dl className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-semibold text-ui-muted-foreground">{label}</dt>
              <dd className="mt-1 [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
        {def.tags.length ? <p className="pc-row-hint">{def.tags.join(" · ")}</p> : null}
      </section>

      {task.reason ? <Notice tone={task.status === "cant_complete" ? "warning" : "info"} title={task.status === "cant_complete" ? "It couldn’t be completed" : "Not applicable"} description={task.reason} /> : null}
      {!task.mine && !closed ? <Notice tone="info" title="This task is restricted to its roles" description={`${roles.join(", ")} complete it. You can read it, comment and raise follow-up actions.`} /> : null}
      {closed && task.exceptionList.length ? (
        <Notice tone="warning" title="Out of range when it was completed" description={<ul className="list-disc pl-5">{task.exceptionList.map((e) => <li key={e}>{e}</li>)}</ul>} />
      ) : null}

      <TaskWork id={task.id} version={task.version} definition={def} checks={task.checks} records={task.records} files={task.files} editable={can.work} />

      <div className="pc-grid">
        <section className="pc-panel" aria-labelledby="task-comments">
          <div className="pc-panel-head">
            <div className="flex flex-col gap-1"><h2 id="task-comments">Comments</h2>{def.requiresComment ? <p className="pc-row-hint">This task needs a comment before it is completed.</p> : null}</div>
            <AddComment id={task.id} />
          </div>
          {task.comments.length === 0 ? <EmptyState compact icon="scrollText" title="No comments yet" /> : (
            <ul className="pc-rows">
              {task.comments.map((c) => (
                <li key={c.id} className="pc-row">
                  <div className="pc-row-body min-w-[min(100%,18rem)]!">
                    <span className="pc-row-title">{c.byName} · {formatDateTime(c.createdAt)}</span>
                    <p className="text-sm whitespace-pre-wrap break-words">{c.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="pc-panel" aria-labelledby="task-actions">
          <div className="pc-panel-head">
            <div className="flex flex-col gap-1"><h2 id="task-actions">Follow-up actions</h2><p className="pc-row-hint">Something to put right because of this task.</p></div>
            <RaiseAction siteId={task.siteId} taskId={task.id} label="Raise one" templates={actionTemplates} />
          </div>
          {task.actions.length === 0 ? <EmptyState compact icon="clipboardList" title="None raised" /> : (
            <ul className="pc-rows">
              {task.actions.map((a) => (
                <li key={a.id} className="pc-row">
                  <span className="pc-row-body">
                    <span className="pc-row-title">{a.title}</span>
                    <span className="pc-row-hint">{[`Raised by ${a.raisedByName}`, a.dueOn ? `needed by ${formatDate(a.dueOn)}` : null,
                      a.status === "resolved" ? `resolved by ${a.resolvedByName}: ${a.resolution}` : null].filter(Boolean).join(" · ")}</span>
                    {a.followUpTaskId ? <Link href={`/tasks/${a.followUpTaskId}`} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Open its follow-up task</Link> : null}
                  </span>
                  <span className="pc-row-trail">
                    <Tag meta={ACTION_STATUS_META[a.status === "resolved" ? "resolved" : "open"]} />
                    {can.review && a.status === "open" ? <ResolveAction id={a.id} title={a.title} /> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
