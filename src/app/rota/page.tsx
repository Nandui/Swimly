import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import {
  addDaysIso, AddShiftSheet, ALL_DEPARTMENTS, CopyDialog, DayPlan, duration, mondayOf, NeedDialog, planWeek, ROTA_WEEK_META, ShareWeek,
} from "@/modules/rota/features/plan";
import { formatDateRange, formatDayMonth, formatWeekday } from "@/lib/format";

export const metadata: Metadata = { title: "Plan" };

/** The department supervisor's Plan (owner decisions, 6 October 2026; shift first, owner, 13 October
 *  2026; every department together with a filter, owner, 16 October 2026; redesigned 20 October
 *  2026): a site's week for one department or all of them, as one surface: a slim week bar (each
 *  day with how much is still to fill), then the open day's board (DayPlan: People or Needs, the
 *  places to fill and the people to check). The week exports to Excel for Timepoint. A draft
 *  until the week is shared with its staff. */
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ site?: string; week?: string; dept?: string; day?: string }> }) {
  const input = await searchParams;
  const data = await planWeek(input);
  if (!data.site) {
    return (
      <PageShell header={<PageHeader title="Plan" />}>
        <EmptyState as="h2" icon="calendarDays" title="No sites to show" hint="Your rota role does not cover a site yet." />
      </PageShell>
    );
  }
  const { site, monday, now, date, department, departments, everyDepartment, week, share, day } = data;
  const link = (q: { week?: string; day?: string; dept?: string }) =>
    `/rota?${new URLSearchParams({ site: site.id, ...(department ? { dept: everyDepartment ? ALL_DEPARTMENTS : department.id } : {}), ...q })}`;
  const sunday = addDaysIso(monday, 6);
  const live = date <= now;
  const thisMonday = mondayOf(now);
  const weeksBack = Array.from({ length: 6 }, (_, i) => addDaysIso(monday, -7 * (i + 1)));
  const daysBack = Array.from({ length: 14 }, (_, i) => addDaysIso(date, -(i + 1)));
  const dateLabel = `${formatWeekday(date)} ${formatDayMonth(date)}`;
  const weekGaps = week.reduce((n, d) => n + d.gapCount, 0);
  const departmentNames = Object.fromEntries(departments.map((d) => [d.id, d.name]));
  return (
    <PageShell className="rota-plan" header={<PageHeader
        title={everyDepartment ? `Plan: ${site.name}` : department ? `Plan: ${department.name}` : "Plan"}
        description={`${site.name} · ${everyDepartment ? "every department. Choose one to copy, export or share its week." : share ? `shared with staff by ${share.sharedByName}.` : "a draft until you share the week with staff."}`}
        status={department && !everyDepartment ? <Tag meta={ROTA_WEEK_META[share ? "shared" : "draft"]} /> : undefined}
        actions={department ? <>
          {data.canShare ? <CopyDialog siteId={site.id} departmentId={department.id} date={date} monday={monday}
            options={{ days: daysBack.map((d) => ({ iso: d, label: `${formatWeekday(d)} ${formatDayMonth(d)}` })), weeks: weeksBack.map((m) => ({ iso: m, label: m === addDaysIso(thisMonday, -7) ? "Last week" : `Week of ${formatDayMonth(m)}` })) }} /> : null}
          {data.canShare ? <Button asChild variant="outline"><a href={`/rota/export?${new URLSearchParams({ site: site.id, dept: department.id, week: monday })}`} download><Download aria-hidden="true" />Export week</a></Button> : null}
          {data.canShare && !share ? <ShareWeek siteId={site.id} departmentId={department.id} monday={monday} department={department.name} gaps={weekGaps} /> : null}
        </> : undefined}
      />}>
      {department && departments.length > 1 ? (
        <SegmentedLinks label="Department" className="rota-departments" items={[
          { href: `/rota?${new URLSearchParams({ site: site.id, dept: ALL_DEPARTMENTS, week: monday, day: date })}`, label: "All departments", current: everyDepartment },
          ...departments.map((d) => ({ href: `/rota?${new URLSearchParams({ site: site.id, dept: d.id, week: monday, day: date })}`, label: d.name, current: !everyDepartment && d.id === department.id })),
        ]} />
      ) : null}
      {!department ? (
        <EmptyState as="h2" icon="calendarDays" title="No departments at this site" hint="An administrator adds them in Admin, Departments. Each activity on the rota belongs to one." />
      ) : (
        <section className="rota-surface" aria-labelledby={`rota-day-${date}`}>
          <nav className="rota-weekbar" aria-label="Week">
            <div className="rota-weekbar-nav">
              <Button asChild variant="outline" size="icon" className="size-11" aria-label="Previous week"><Link href={link({ week: addDaysIso(monday, -7) })}><ChevronLeft aria-hidden="true" /></Link></Button>
              <span className="rota-weekbar-range tabular-nums">{formatDateRange(monday, sunday)}</span>
              <Button asChild variant="outline" size="icon" className="size-11" aria-label="Next week"><Link href={link({ week: addDaysIso(monday, 7) })}><ChevronRight aria-hidden="true" /></Link></Button>
              {date !== now ? <Button asChild variant="ghost"><Link href={link({ week: thisMonday, day: now })}>Today</Link></Button> : null}
              <span className="rota-weekbar-total tabular-nums">{weekGaps ? `${weekGaps} to fill this week` : "Nothing to fill this week"}</span>
            </div>
            <ul className="rota-days">
              {week.map((d) => {
                const state = !d.planned ? "empty" : d.gapCount ? "gaps" : "covered";
                return (
                  <li key={d.iso}>
                    <Button asChild variant="ghost" className="rota-day-tab" data-state={state} data-today={d.iso === now ? "" : undefined}>
                      <Link href={link({ day: d.iso })} aria-current={d.iso === date ? "date" : undefined}
                        aria-label={`${formatWeekday(d.iso)} ${formatDayMonth(d.iso)}${d.iso === now ? ", today" : ""}: ${d.staff ? `${d.staff} staff, ${duration(d.paidMinutes)}` : "nobody added yet"}, ${!d.planned ? "nothing planned" : d.gapCount ? `${d.gapCount} to fill` : "covered"}`}>
                        <span className="rota-day-dow">{formatWeekday(d.iso, "short")}</span>
                        <span className="rota-day-num tabular-nums">{formatDayMonth(d.iso).split(" ")[0]}</span>
                        <span className="rota-day-state tabular-nums">{!d.planned ? "—" : d.gapCount ? `${d.gapCount} to fill` : "Covered"}</span>
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <DayPlan siteId={site.id} departmentId={department.id} everyDepartment={everyDepartment} departmentNames={departmentNames} date={date} dateLabel={dateLabel} live={live}
            heading={`${formatWeekday(date)} ${formatDayMonth(date)}${date === now ? ", today" : ""}`} today={date === now}
            actions={data.canChange ? <>
              <AddShiftSheet siteId={site.id} departmentId={department.id} departments={everyDepartment ? data.changeable : undefined} date={date} dateLabel={dateLabel} live={live} />
              {data.types.length ? <NeedDialog siteId={site.id} date={date} live={live} types={data.types} areas={data.areas} /> : null}
            </> : undefined}
            note={data.canChange ? undefined : data.blocked === "come" ? "This day has come: the duty manager changes it from Today."
              : data.blocked === "member" ? `You plan only the departments you belong to, and ${everyDepartment ? "none of them are" : `${department.name} is not one of yours`}. An administrator ticks it under Departments on your profile in HR, People.`
              : "You can see this plan. Planning it needs the Plan level for Rota in your role."}
            canChange={data.canChange} zones={day.zones} groups={day.groups} allGroups={data.allGroups} people={day.people} hours={data.hours} types={data.types} anyTypes={data.anyTypes} areaList={data.areas} />
        </section>
      )}
    </PageShell>
  );
}
