import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CalendarDays, Check, ChevronLeft, ChevronRight, CircleCheck, ClipboardList, Clock3, Flag, Gauge, ShieldCheck } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Progress } from "@/components/shadcn/progress";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordFacts, RecordSection } from "@/components/ui-kit/record";
import { SearchField } from "@/components/ui-kit/search-field";
import { Tag } from "@/components/ui-kit/tag";
import { SiteSettings } from "@/modules/tasks/features/sites";
import { AddTask, clockOf, DAY_FILTERS, SITE_STATUS_META, taskDay, type TaskRow, type TaskState, TaskStateTag } from "@/modules/tasks/features/day";
import { addDaysIso, formatDayMonth, formatWeekday } from "@/lib/format";

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
      <PageShell header={<PageHeader title="Today" />}>
        <EmptyState as="h2" icon="building" title="No sites to show" hint="Your role does not do tasks at a site yet." />
      </PageShell>
    );
  }
  const { site, settings, date, day, tasks, total, figures, planned, addable, openActions, filters, tags, closed } = data;
  const link = (extra: Record<string, string>) => `/tasks?${new URLSearchParams({ site: site.id, ...(date === day ? {} : { date }), ...extra })}`;
  const dayLink = (d: string) => `/tasks?${new URLSearchParams({ site: site.id, ...(d === day ? {} : { date: d }) })}`;
  const isToday = date === day;
  const filtered = !!(filters.q || filters.tag || filters.status !== "all");
  return (
    <PageShell spacing="roomy" header={<PageHeader
        title={isToday ? "Today" : `${formatWeekday(date)} ${formatDayMonth(date)}`}
        description={`${site.name} · ${isToday ? `${formatWeekday(date)} ${formatDayMonth(date)}` : date > day ? "planned from the published schedules" : "an earlier day"}`}
        status={settings.status !== "live" ? <Tag meta={SITE_STATUS_META[settings.status]} /> : undefined}
        actions={date <= day && addable.length && !closed ? <AddTask siteId={site.id} date={date} templates={addable} /> : undefined}
      />}>

      {date <= day ? (
        <ul className="pc-stats" data-compact aria-label="The day at a glance">
          <li className="flex"><div className="pc-stat w-full">
            <span className="pc-stat-label"><CircleCheck aria-hidden="true" />Completed</span>
            <span className="pc-stat-figure">{figures.done}<span className="text-(--label-2)"> of {figures.total}</span></span>
            <Progress value={figures.total ? (figures.done / figures.total) * 100 : 0} aria-label={`${figures.done} of ${figures.total} completed`} className="w-full" />
          </div></li>
          <li className="flex"><div className="pc-stat w-full">
            <span className="pc-stat-label"><Clock3 aria-hidden="true" />Remaining</span>
            <span className="pc-stat-figure" data-zero={figures.remaining ? undefined : ""}>{figures.remaining}</span>
            <span className="pc-stat-hint" data-tone={figures.overdue ? "orange" : undefined}>{figures.overdue ? `${figures.overdue} overdue or missed` : "Across the working day"}</span>
          </div></li>
          <li className="flex"><Link href={link({ status: "approval" })} className="pc-stat w-full" aria-current={filters.status === "approval" ? "true" : undefined}>
            <span className="pc-stat-label"><ShieldCheck aria-hidden="true" />Awaiting approval</span>
            <span className="pc-stat-figure" data-zero={figures.approval ? undefined : ""}>{figures.approval}</span>
            <span className="pc-stat-hint">Review completed work</span>
          </Link></li>
          <li className="flex"><Link href={`/tasks/actions?site=${site.id}`} className="pc-stat w-full">
            <span className="pc-stat-label"><Flag aria-hidden="true" />Open actions</span>
            <span className="pc-stat-figure" data-zero={openActions ? undefined : ""}>{openActions}</span>
            <span className="pc-stat-hint">See what needs follow-up</span>
          </Link></li>
          <li className="flex"><div className="pc-stat w-full">
            <span className="pc-stat-label"><Gauge aria-hidden="true" />Score</span>
            <span className="pc-stat-figure" data-zero={figures.score === null ? "" : undefined}>{figures.score === null ? "None yet" : `${figures.score}%`}</span>
            <span className="pc-stat-hint">On time counts in full, late half</span>
          </div></li>
        </ul>
      ) : null}

      <section className="flex min-w-0 flex-col gap-(--space-3)" aria-label="Day and filters">
        <div className="flex flex-wrap items-end gap-4">
          <nav aria-label="Day" className="flex items-end gap-2">
            <Button asChild variant="outline" size="icon"><Link href={dayLink(addDaysIso(date, -1))} aria-label="Previous day"><ChevronLeft aria-hidden="true" /></Link></Button>
            <form method="get" className="flex items-end gap-2" aria-label="Choose a day">
              <input type="hidden" name="site" value={site.id} />
              <div className="space-y-2"><Label htmlFor="task-date" className="block">Day</Label>
                <Input id="task-date" name="date" type="date" defaultValue={date} className="min-h-11" /></div>
              <Button type="submit" variant="outline">Go</Button>
            </form>
            <Button asChild variant="outline" size="icon"><Link href={dayLink(addDaysIso(date, 1))} aria-label="Next day"><ChevronRight aria-hidden="true" /></Link></Button>
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

      <div className="grid gap-(--space-6) lg:grid-cols-main-rail lg:items-start">
        <div className="flex min-w-0 flex-col gap-(--space-6)">
          {date > day ? (
            <RecordSection id="tasks-planned" title="Planned" aside={planned.length ? <p>{planned.length}</p> : null}>
              {planned.length === 0 ? <div className="pc-list"><EmptyState compact icon="clipboardCheck" title={closed ? "The site is closed that day" : "Nothing is scheduled that day"} /></div> : (
                <ul className="pc-list">
                  {planned.map((p) => (
                    <li key={p.key} className="pc-row">
                      <span className="pc-tile-icon" aria-hidden="true">{p.priority ? <Flag /> : <ClipboardList />}</span>
                      <span className="pc-row-body"><span className="pc-row-title">{p.title}</span>
                        <span className="pc-row-hint">{[`${clockOf(p.startsAt, settings.timezone)} to ${clockOf(p.dueAt, settings.timezone)}`, ...p.tags, p.priority ? "High priority" : null].filter(Boolean).join(" · ")}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </RecordSection>
          ) : (() => {
            const groups = GROUPS.map((g) => ({ ...g, rows: tasks.filter((t) => g.states.includes(t.state)) })).filter((g) => g.rows.length);
            if (!groups.length) {
              return (
                <EmptyState icon="clipboardCheck" title={closed ? "Site closed today" : total ? "Nothing matches" : "Nothing here just now"}
                  hint={closed ? "No tasks are made on a closed date." : total ? "Try another filter." : "Try another date, or add an ad hoc task."} />
              );
            }
            return groups.map((g) => <TaskGroup key={g.id} id={`tasks-${g.id}`} group={g.id} title={g.title} hint={g.hint} tasks={g.rows} zone={settings.timezone} />);
          })()}
        </div>

        <RecordSection id="tasks-glance" title="At a glance">
          <div className="rec-card">
            <div className="flex items-center gap-3">
              <span className="pc-tile-icon" aria-hidden="true"><Building2 /></span>
              <span className="min-w-0"><span className="block font-semibold">{site.name}</span><span className="rec-muted rec-small block">{[settings.area, settings.timezone].filter(Boolean).join(" · ")}</span></span>
            </div>
            <RecordFacts items={[["Opening", settings.opening], ["Closing", settings.closing], ["High-priority tasks left", String(figures.priorityLeft)], ["Closed dates ahead", String(settings.closedDates.filter((d) => d >= day).length)]]} />
            {data.who.manage ? <SiteSettings site={{ ...settings, name: site.name }} /> : null}
          </div>
        </RecordSection>
      </div>
    </PageShell>
  );
}

/** A group's tile tone: orange where it needs someone, green once done, red for an exception. */
const GROUP_TONE: Record<string, "orange" | "green" | "red" | undefined> = { attention: "orange", done: "green", exceptions: "red" };

/** One group of the day's tasks: its title and count above, what it holds under the title, the
 *  tasks as a grouped list, each tile toned by the group. */
function TaskGroup({ id, group, title, hint, tasks, zone }: { id: string; group: string; title: string; hint: string; tasks: TaskRow[]; zone: string }) {
  return (
    <RecordSection id={id} title={title} aside={<p>{tasks.length}</p>} note={hint}>
      <ul className="pc-list">
        {tasks.map((t) => (
          <li key={t.id}>
            <Link href={`/tasks/${t.id}`} className="pc-row">
              <span className="pc-tile-icon" data-tone={GROUP_TONE[group]} aria-hidden="true">{t.completedAt && t.state !== "cant_complete" && t.state !== "not_applicable" ? <Check /> : t.priority ? <Flag /> : <ClipboardList />}</span>
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
                <span className="pc-row-value"><span className="sr-only">Due </span>{clockOf(t.dueAt, zone)}</span>
                <TaskStateTag state={t.state} />
                <ChevronRight aria-hidden="true" className="pc-row-chevron" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </RecordSection>
  );
}
