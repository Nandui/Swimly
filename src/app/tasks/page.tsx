import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, CircleCheck, ClipboardCheck, Flag, Gauge, Hourglass, TriangleAlert } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { AddTask } from "@/components/tasks/task-dialogs";
import { TaskStateTag } from "@/components/tasks/status";
import { formatDayMonth, formatWeekday } from "@/lib/format";
import { taskDay, type TaskRow } from "@/lib/tasks/data";
import { addDays, clockOf, NEEDS_DOING, type TaskState } from "@/lib/tasks/rules";

export const metadata: Metadata = { title: "Today" };

const ATTENTION: readonly TaskState[] = ["overdue", "missed", "cant_complete", "approval"];

/** One site's day (from the approved prototype, 8 October 2026): its figures, then what needs
 *  attention, what is still to do and what is done. A later day shows what is planned. */
export default async function TasksTodayPage({ searchParams }: { searchParams: Promise<{ site?: string; date?: string }> }) {
  const input = await searchParams;
  const data = await taskDay(input.site, input.date);
  if (!data.site) {
    return (
      <>
        <PageHeader title="Today" />
        <EmptyState as="h2" icon="building" title="No sites to show" hint="Your role does not do tasks at a site yet." />
      </>
    );
  }
  const { site, date, day, tasks, figures, planned, addable, openActions } = data;
  const link = (d: string) => `/tasks?${new URLSearchParams({ site: site.id, ...(d === day ? {} : { date: d }) })}`;
  const isToday = date === day;
  const attention = tasks.filter((t) => ATTENTION.includes(t.state));
  const todo = tasks.filter((t) => NEEDS_DOING.includes(t.state) && !ATTENTION.includes(t.state));
  const done = tasks.filter((t) => !NEEDS_DOING.includes(t.state) && !ATTENTION.includes(t.state));
  const tiles = [
    { label: "Done", value: `${figures.done} of ${figures.total}`, hint: isToday ? "Across the day so far" : "That day", icon: CircleCheck },
    { label: "Overdue or missed", value: figures.overdue, hint: "Past their due time", icon: TriangleAlert },
    { label: "Awaiting approval", value: figures.approval, hint: "Done, waiting for a reviewer", icon: Hourglass },
    { label: "Score", value: figures.score === null ? "None yet" : `${figures.score}%`, hint: "On time counts in full, late half", icon: Gauge },
    { label: "Open actions", value: openActions, hint: "Follow-ups at this site", icon: Flag, href: `/tasks/actions?site=${site.id}` },
  ];
  return (
    <>
      <PageHeader
        title={isToday ? `Today: ${site.name}` : `${site.name}: ${formatWeekday(date)} ${formatDayMonth(date)}`}
        description={isToday ? `${formatWeekday(date)} ${formatDayMonth(date)} · the site's checks and logs` : date > day ? "Planned from the published schedules" : "An earlier day"}
        actions={<>
          <nav aria-label="Day" className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon"><Link href={link(addDays(date, -1))} aria-label="Previous day"><ChevronLeft aria-hidden="true" /></Link></Button>
            {!isToday ? <Button asChild variant="outline"><Link href={link(day)}><CalendarDays aria-hidden="true" />Today</Link></Button> : null}
            <Button asChild variant="outline" size="icon"><Link href={link(addDays(date, 1))} aria-label="Next day"><ChevronRight aria-hidden="true" /></Link></Button>
          </nav>
          {date <= day && addable.length ? <AddTask siteId={site.id} date={date} templates={addable} /> : null}
        </>}
      />

      {date <= day ? (
        <ul className="pc-stats" aria-label="The day at a glance">
          {tiles.map(({ label, value, hint, icon: Icon, href }) => {
            const body = <>
              <span className="pc-tile-icon"><Icon aria-hidden="true" /></span>
              <span><span className="pc-stat-figure block">{value}</span><span className="block font-semibold">{label}</span></span>
              <span className="text-xs text-ui-muted-foreground">{hint}</span>
            </>;
            return <li key={label} className="flex">{href ? <Link href={href} className="pc-stat w-full">{body}</Link> : <div className="pc-stat w-full">{body}</div>}</li>;
          })}
        </ul>
      ) : null}

      {date > day ? (
        <section className="pc-panel" aria-labelledby="tasks-planned">
          <div className="pc-panel-head"><h2 id="tasks-planned">Planned</h2></div>
          {planned.length === 0 ? <EmptyState compact icon="clipboardCheck" title="Nothing is scheduled that day" /> : (
            <ul className="pc-rows">
              {planned.map((p) => (
                <li key={p.key} className="pc-row">
                  <span className="pc-tile-icon" aria-hidden="true"><ClipboardCheck /></span>
                  <span className="pc-row-body"><span className="pc-row-title">{p.title}</span>
                    <span className="pc-row-hint">{[`${clockOf(p.startsAt)} to ${clockOf(p.dueAt)}`, ...p.tags, p.priority ? "High priority" : null].filter(Boolean).join(" · ")}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : tasks.length === 0 ? (
        <section className="pc-panel" aria-label="Tasks">
          <EmptyState icon="clipboardCheck" title={isToday ? "No tasks today" : "No tasks that day"}
            hint={data.who.manage ? "Publish a template with a schedule and its tasks appear here." : "Whoever manages Tasks writes the templates that make them."} />
        </section>
      ) : (
        <>
          {attention.length ? <TaskPanel id="tasks-attention" title="Needs attention" hint="Overdue, missed, can't be done, or waiting for a reviewer" tasks={attention} /> : null}
          <TaskPanel id="tasks-todo" title="To do" tasks={todo} empty={isToday ? "Nothing left to do" : "Nothing was left"} />
          <TaskPanel id="tasks-done" title="Done" tasks={done} empty="Nothing done yet" />
        </>
      )}
    </>
  );
}

function TaskPanel({ id, title, hint, tasks, empty }: { id: string; title: string; hint?: string; tasks: TaskRow[]; empty?: string }) {
  return (
    <section className="pc-panel" aria-labelledby={id}>
      <div className="pc-panel-head">
        <div className="flex flex-col gap-1"><h2 id={id}>{title} <span className="text-ui-muted-foreground tabular-nums">· {tasks.length}</span></h2>{hint ? <p className="pc-row-hint">{hint}</p> : null}</div>
      </div>
      {tasks.length === 0 ? <EmptyState compact icon="clipboardCheck" title={empty ?? "None"} /> : (
        <ul className="pc-rows">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link href={`/tasks/${t.id}`} className="pc-row">
                <span className="pc-tile-icon" aria-hidden="true">{t.priority ? <Flag /> : <ClipboardCheck />}</span>
                <span className="pc-row-body">
                  <span className="pc-row-title">{t.title}</span>
                  <span className="pc-row-hint">{[
                    t.completedByName ? `${t.state === "cant_complete" ? "Flagged" : t.state === "not_applicable" ? "Marked" : "Done"} by ${t.completedByName}` : `Due ${clockOf(t.dueAt)}`,
                    ...t.tags, t.priority ? "High priority" : null, t.mine ? null : "For other roles",
                    t.exceptions ? `${t.exceptions} out of range` : null, t.openActions ? `${t.openActions} open ${t.openActions === 1 ? "action" : "actions"}` : null,
                    t.comments ? `${t.comments} ${t.comments === 1 ? "comment" : "comments"}` : null,
                  ].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="pc-row-trail">
                  <TaskStateTag state={t.state} />
                  <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
