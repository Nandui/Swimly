import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, CalendarDays, Check, ChevronLeft, ChevronRight, CircleCheck, ClipboardList, Clock3, Flag, Gauge, ShieldCheck } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Progress } from "@/components/shadcn/progress";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SearchField } from "@/components/ui-kit/search-field";
import { Tag } from "@/components/ui-kit/tag";
import { SiteSettings } from "@/components/tasks/site-settings";
import { AddTask } from "@/components/tasks/task-dialogs";
import { TaskStateTag } from "@/components/tasks/status";
import { formatDayMonth, formatWeekday } from "@/lib/format";
import { DAY_FILTERS, taskDay, type TaskRow } from "@/lib/tasks/data";
import { SITE_STATUS_META, addDays, clockOf, type TaskState } from "@/lib/tasks/rules";

export const metadata: Metadata = { title: "Today" };

/** The prototype's four groups, in its order. */
const GROUPS: { id: string; title: string; hint: string; states: readonly TaskState[] }[] = [
  { id: "attention", title: "Needs attention", hint: "Overdue or waiting for a reviewer", states: ["overdue", "approval"] },
  { id: "todo", title: "Still to do", hint: "The remaining tasks for the day", states: ["open", "upcoming"] },
  { id: "done", title: "Completed and reviewed", hint: "Work already taken care of", states: ["done", "early", "late", "approved"] },
  { id: "exceptions", title: "Exceptions", hint: "Flagged, not applicable or missed", states: ["cant_complete", "not_applicable", "missed"] },
];

/** One site's day (from the approved prototype, 8 October 2026): its figures, the day and filters
 *  (words, status, tag), the tasks in four groups, and the site at a glance. A later day shows
 *  what is planned. */
export default async function TasksTodayPage({ searchParams }: { searchParams: Promise<{ site?: string; date?: string; q?: string; status?: string; tag?: string }> }) {
  const data = await taskDay(await searchParams);
  if (!data.site) {
    return (
      <>
        <PageHeader title="Today" />
        <EmptyState as="h2" icon="building" title="No sites to show" hint="Your role does not do tasks at a site yet." />
      </>
    );
  }
  const { site, settings, date, day, tasks, total, figures, planned, addable, openActions, filters, tags, closed } = data;
  const link = (extra: Record<string, string>) => `/tasks?${new URLSearchParams({ site: site.id, ...(date === day ? {} : { date }), ...extra })}`;
  const dayLink = (d: string) => `/tasks?${new URLSearchParams({ site: site.id, ...(d === day ? {} : { date: d }) })}`;
  const isToday = date === day;
  const filtered = !!(filters.q || filters.tag || filters.status !== "all");
  return (
    <>
      <PageHeader
        title={isToday ? `Today: ${site.name}` : `${site.name}: ${formatWeekday(date)} ${formatDayMonth(date)}`}
        description={isToday ? `${formatWeekday(date)} ${formatDayMonth(date)} · a clear view of the day` : date > day ? "Planned from the published schedules" : "An earlier day"}
        status={settings.status !== "live" ? <Tag meta={SITE_STATUS_META[settings.status]} /> : undefined}
        actions={date <= day && addable.length && !closed ? <AddTask siteId={site.id} date={date} templates={addable} /> : undefined}
      />

      {date <= day ? (
        <ul className="pc-stats" aria-label="The day at a glance">
          <li className="flex"><div className="pc-stat w-full">
            <span className="pc-tile-icon"><CircleCheck aria-hidden="true" /></span>
            <span><span className="pc-stat-figure block">{figures.done} <span className="text-ui-muted-foreground">/ {figures.total}</span></span><span className="block font-semibold">Completed</span></span>
            <Progress value={figures.total ? (figures.done / figures.total) * 100 : 0} aria-label={`${figures.done} of ${figures.total} completed`} className="w-full" />
          </div></li>
          <li className="flex"><div className="pc-stat w-full">
            <span className="pc-tile-icon"><Clock3 aria-hidden="true" /></span>
            <span><span className="pc-stat-figure block">{figures.remaining}</span><span className="block font-semibold">Remaining</span></span>
            <span className="text-xs text-ui-muted-foreground">{figures.overdue ? `${figures.overdue} overdue or missed` : "Across the working day"}</span>
          </div></li>
          <li className="flex"><Link href={link({ status: "approval" })} className="pc-stat w-full" aria-current={filters.status === "approval" ? "true" : undefined}>
            <span className="pc-tile-icon"><ShieldCheck aria-hidden="true" /></span>
            <span><span className="pc-stat-figure block">{figures.approval}</span><span className="block font-semibold">Awaiting approval</span></span>
            <span className="inline-flex items-center gap-1 text-xs text-ui-primary">Review completed work<ArrowUpRight aria-hidden="true" className="size-3" /></span>
          </Link></li>
          <li className="flex"><Link href={`/tasks/actions?site=${site.id}`} className="pc-stat w-full">
            <span className="pc-tile-icon"><Flag aria-hidden="true" /></span>
            <span><span className="pc-stat-figure block">{openActions}</span><span className="block font-semibold">Open actions</span></span>
            <span className="inline-flex items-center gap-1 text-xs text-ui-primary">See what needs follow-up<ArrowUpRight aria-hidden="true" className="size-3" /></span>
          </Link></li>
          <li className="flex"><div className="pc-stat w-full">
            <span className="pc-tile-icon"><Gauge aria-hidden="true" /></span>
            <span><span className="pc-stat-figure block">{figures.score === null ? "None yet" : `${figures.score}%`}</span><span className="block font-semibold">Score</span></span>
            <span className="text-xs text-ui-muted-foreground">On time counts in full, late half</span>
          </div></li>
        </ul>
      ) : null}

      <section className="pc-panel" aria-label="Day and filters">
        <div className="flex flex-wrap items-end gap-4">
          <nav aria-label="Day" className="flex items-end gap-2">
            <Button asChild variant="outline" size="icon"><Link href={dayLink(addDays(date, -1))} aria-label="Previous day"><ChevronLeft aria-hidden="true" /></Link></Button>
            <form method="get" className="flex items-end gap-2" aria-label="Choose a day">
              <input type="hidden" name="site" value={site.id} />
              <div className="space-y-2"><Label htmlFor="task-date" className="block">Day</Label>
                <Input id="task-date" name="date" type="date" defaultValue={date} className="min-h-11" /></div>
              <Button type="submit" variant="outline">Go</Button>
            </form>
            <Button asChild variant="outline" size="icon"><Link href={dayLink(addDays(date, 1))} aria-label="Next day"><ChevronRight aria-hidden="true" /></Link></Button>
            {!isToday ? <Button asChild variant="ghost"><Link href={dayLink(day)}><CalendarDays aria-hidden="true" />Today</Link></Button> : null}
          </nav>
          {date <= day ? (
            <form method="get" role="search" aria-label="Filter tasks" className="flex grow flex-wrap items-end gap-4">
              <input type="hidden" name="site" value={site.id} />
              {date !== day ? <input type="hidden" name="date" value={date} /> : null}
              <SearchField label="Search tasks" placeholder="Task or tag" name="q" defaultValue={filters.q} className="grow basis-56" />
              <div className="min-w-0 grow basis-40 space-y-2 sm:grow-0 sm:min-w-44"><Label htmlFor="task-status" className="block">Show</Label>
                <NativeSelect id="task-status" name="status" defaultValue={filters.status} className="min-h-11 w-full">
                  {Object.entries(DAY_FILTERS).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
                </NativeSelect></div>
              <div className="min-w-0 grow basis-40 space-y-2 sm:grow-0 sm:min-w-40"><Label htmlFor="task-tag" className="block">Tag</Label>
                <NativeSelect id="task-tag" name="tag" defaultValue={filters.tag} className="min-h-11 w-full">
                  <NativeSelectOption value="">All tags</NativeSelectOption>
                  {tags.map((t) => <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>)}
                </NativeSelect></div>
              <div className="flex gap-2">
                <Button type="submit" variant="outline">Apply</Button>
                {filtered ? <Button asChild variant="ghost"><Link href={dayLink(date)}>Reset</Link></Button> : null}
              </div>
            </form>
          ) : null}
        </div>
        {filtered ? <p className="text-xs text-ui-muted-foreground">{tasks.length} of {total} tasks match.</p> : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {date > day ? (
            <section className="pc-panel" aria-labelledby="tasks-planned">
              <div className="pc-panel-head"><h2 id="tasks-planned">Planned</h2></div>
              {planned.length === 0 ? <EmptyState compact icon="clipboardCheck" title={closed ? "The site is closed that day" : "Nothing is scheduled that day"} /> : (
                <ul className="pc-rows">
                  {planned.map((p) => (
                    <li key={p.key} className="pc-row">
                      <span className="pc-tile-icon" aria-hidden="true">{p.priority ? <Flag /> : <ClipboardList />}</span>
                      <span className="pc-row-body"><span className="pc-row-title">{p.title}</span>
                        <span className="pc-row-hint">{[`${clockOf(p.startsAt, settings.timezone)} to ${clockOf(p.dueAt, settings.timezone)}`, ...p.tags, p.priority ? "High priority" : null].filter(Boolean).join(" · ")}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (() => {
            const groups = GROUPS.map((g) => ({ ...g, rows: tasks.filter((t) => g.states.includes(t.state)) })).filter((g) => g.rows.length);
            if (!groups.length) {
              return (
                <section className="pc-panel" aria-label="Tasks">
                  <EmptyState icon="clipboardCheck" title={closed ? "Site closed today" : total ? "Nothing matches" : "Nothing here just now"}
                    hint={closed ? "No tasks are made on a closed date." : total ? "Try another filter." : "Try another date, or add an ad hoc task."} />
                </section>
              );
            }
            return groups.map((g) => <TaskPanel key={g.id} id={`tasks-${g.id}`} title={g.title} hint={g.hint} tasks={g.rows} zone={settings.timezone} />);
          })()}
        </div>

        <aside className="pc-panel" aria-labelledby="tasks-glance">
          <div className="pc-panel-head"><h2 id="tasks-glance">At a glance</h2><CalendarDays aria-hidden="true" className="size-5 text-ui-muted-foreground" /></div>
          <div className="flex items-center gap-3">
            <span className="pc-tile-icon" aria-hidden="true"><Building2 /></span>
            <span className="min-w-0"><span className="block font-semibold">{site.name}</span><span className="block text-xs text-ui-muted-foreground">{[settings.area, settings.timezone].filter(Boolean).join(" · ")}</span></span>
          </div>
          <dl className="flex flex-col">
            {[["Opening", settings.opening], ["Closing", settings.closing], ["High-priority tasks left", String(figures.priorityLeft)], ["Closed dates ahead", String(settings.closedDates.filter((d) => d >= day).length)]].map(([k, v]) => (
              <div key={k} className="flex min-h-11 items-center justify-between gap-2 border-b border-[var(--pc-line)] last:border-b-0">
                <dt className="text-sm text-ui-muted-foreground">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {data.who.manage ? <SiteSettings site={{ ...settings, name: site.name }} /> : null}
        </aside>
      </div>
    </>
  );
}

function TaskPanel({ id, title, hint, tasks, zone }: { id: string; title: string; hint: string; tasks: TaskRow[]; zone: string }) {
  return (
    <section className="pc-panel" aria-labelledby={id}>
      <div className="pc-panel-head">
        <div className="flex flex-col gap-1"><h2 id={id}>{title} <span className="text-ui-muted-foreground tabular-nums">· {tasks.length}</span></h2><p className="pc-row-hint">{hint}</p></div>
      </div>
      <ul className="pc-rows">
        {tasks.map((t) => (
          <li key={t.id}>
            <Link href={`/tasks/${t.id}`} className="pc-row">
              <span className="pc-tile-icon" aria-hidden="true">{t.completedAt && t.state !== "cant_complete" && t.state !== "not_applicable" ? <Check /> : t.priority ? <Flag /> : <ClipboardList />}</span>
              <span className="pc-row-body">
                <span className="pc-row-title">{t.title}</span>
                <span className="pc-row-hint">{[
                  t.completedByName ? `${t.state === "cant_complete" ? "Flagged" : t.state === "not_applicable" ? "Marked" : "Done"} by ${t.completedByName}` : null,
                  ...t.tags, t.priority ? "High priority" : null, t.mine ? null : "For other roles",
                  t.exceptions ? `${t.exceptions} out of range` : null, t.openActions ? `${t.openActions} open ${t.openActions === 1 ? "action" : "actions"}` : null,
                  t.comments ? `${t.comments} ${t.comments === 1 ? "comment" : "comments"}` : null,
                ].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="pc-row-trail">
                <span className="inline-flex items-center gap-1 text-sm tabular-nums text-ui-muted-foreground"><Clock3 aria-hidden="true" className="size-4" /><span className="sr-only">Due </span>{clockOf(t.dueAt, zone)}</span>
                <TaskStateTag state={t.state} />
                <ChevronRight aria-hidden="true" className="pc-row-chevron" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
