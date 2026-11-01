import type { Metadata } from "next";
import { cache } from "react";
import { Tag } from "@/components/ui-kit/tag";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordFacts, RecordSection } from "@/components/ui-kit/record";
import {
  ACTION_STATUS_META, AddComment, ApproveTask, CantComplete, clockOf, dayIn, NotApplicable, PRIORITY_META, ReopenTask, taskDetail, TaskStateTag, TaskWork,
} from "@/modules/tasks/features/day";
import { RaiseAction, ResolveAction } from "@/modules/tasks/features/follow-ups";
import Link from "next/link";
import { formatDate, formatDateTime, formatDayMonth, formatWeekday } from "@/lib/format";

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
    ["Day", `${formatWeekday(task.date)} ${formatDayMonth(task.date)}`],
    ["For", roles.length ? `${roles.join(", ")}${def.restricted === false ? " (anyone may complete it)" : ""}` : "Everyone at the site"],
    ...(task.addedByName ? [["Added by", task.addedByName] as [string, string]] : []),
    ...(task.completedByName ? [[task.status === "done" ? "Completed by" : "Closed by", task.completedByName] as [string, string]] : []),
    ...(task.approvedByName ? [["Approved by", task.approvedByName] as [string, string]] : []),
  ];
  return (
    <PageShell spacing="roomy" header={<PageHeader
        back={{ href: back, label: isToday ? "Today" : formatDayMonth(task.date) }}
        eyebrow={<p className="rec-head"><TaskStateTag state={task.state} />{def.priority ? <Tag meta={PRIORITY_META} /> : null}<span className="tabular-nums">{clockOf(task.startsAt, task.timezone)} to {clockOf(task.dueAt, task.timezone)} · {task.siteName}</span></p>}
        title={def.title}
        description={def.description || undefined}
        actions={<>
          {can.work && !closed ? <CantComplete id={task.id} version={task.version} /> : null}
          {can.review && !closed ? <NotApplicable id={task.id} version={task.version} /> : null}
          {can.review && closed ? <ReopenTask id={task.id} version={task.version} /> : null}
          {can.approve ? <ApproveTask id={task.id} version={task.version} /> : null}
        </>}
      />}>

      <RecordSection id="task-details" title="Details">
        <div className="rec-card"><RecordFacts items={[...facts, ...(def.tags.length ? [["Tags", def.tags.join(" · ")] as [string, string]] : [])]} /></div>
      </RecordSection>

      {task.reason ? <Notice tone={task.status === "cant_complete" ? "warning" : "info"} title={task.status === "cant_complete" ? "It couldn’t be completed" : "Not applicable"} description={task.reason} /> : null}
      {!task.mine && !closed ? <Notice tone="info" title="This task is restricted to its roles" description={`${roles.join(", ")} complete it. You can read it, comment and raise follow-up actions.`} /> : null}
      {closed && task.exceptionList.length ? (
        <Notice tone="warning" title="Out of range when it was completed" description={<ul className="list-disc pl-5">{task.exceptionList.map((e) => <li key={e}>{e}</li>)}</ul>} />
      ) : null}

      <TaskWork id={task.id} version={task.version} definition={def} checks={task.checks} records={task.records} files={task.files} editable={can.work} />

      <div className="pc-grid">
        <RecordSection id="task-comments" title="Comments" aside={<AddComment id={task.id} />} note={def.requiresComment ? "This task needs a comment before it is completed." : undefined}>
          {task.comments.length === 0 ? <div className="pc-list"><EmptyState compact icon="scrollText" title="No comments yet" /></div> : (
            <ul className="pc-list">
              {task.comments.map((c) => (
                <li key={c.id} className="pc-row">
                  <div className="pc-row-body min-w-field!">
                    <span className="pc-row-title">{c.byName} · {formatDateTime(c.createdAt)}</span>
                    <p className="text-sm whitespace-pre-wrap break-words">{c.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </RecordSection>
        <RecordSection id="task-actions" title="Follow-up actions" aside={<RaiseAction siteId={task.siteId} taskId={task.id} label="Raise one" templates={actionTemplates} />} note="Something to put right because of this task.">
          {task.actions.length === 0 ? <div className="pc-list"><EmptyState compact icon="clipboardList" title="None raised" /></div> : (
            <ul className="pc-list">
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
        </RecordSection>
      </div>
    </PageShell>
  );
}
