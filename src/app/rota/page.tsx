import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import {
  addDaysIso, AddShiftSheet, CopyDialog, DayPlan, duration, LinkPicker, mondayOf, NeedDialog, partPaid, PeoplePlan, planWeek, ROTA_DAY_META, ROTA_SHIFT_NOTE_META, ROTA_WEEK_META, ShareWeek,
} from "@/modules/rota/features/plan";
import { formatDateRange, formatDayMonth, formatWeekday } from "@/lib/format";

export const metadata: Metadata = { title: "Plan" };

/** The department supervisor's Plan (owner decisions, 6 October 2026; shift first, owner, 13 October
 *  2026): one department's week at a site, a strip of its days with their staff, hours and gaps,
 *  then the open day: what needs people, and each person's shift with what they are on, their
 *  breaks and the time still free. The week exports to Excel for Timepoint. Below 1024px the day
 *  is an agenda and Who's working a list. A draft until the week is shared with its staff. */
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ site?: string; week?: string; dept?: string; day?: string }> }) {
  const input = await searchParams;
  const data = await planWeek(input);
  if (!data.site) {
    return (
      <>
        <PageHeader title="Plan" />
        <EmptyState as="h2" icon="calendarDays" title="No sites to show" hint="Your rota role does not cover a site yet." />
      </>
    );
  }
  const { site, monday, now, date, department, departments, week, share, day } = data;
  const link = (q: { week?: string; day?: string; dept?: string }) =>
    `/rota?${new URLSearchParams({ site: site.id, ...(department ? { dept: department.id } : {}), ...q })}`;
  const sunday = addDaysIso(monday, 6);
  const live = date <= now;
  const dayGaps = day.gapCount;
  const warned = day.people.filter((p) => p.warnings.length || p.rest.length || p.breakClashes.length || p.shift.parts.some((x) => x.unplaced.length)).length;
  const thisMonday = mondayOf(now);
  const weeksBack = Array.from({ length: 6 }, (_, i) => addDaysIso(monday, -7 * (i + 1)));
  const daysBack = Array.from({ length: 14 }, (_, i) => addDaysIso(date, -(i + 1)));
  const dateLabel = `${formatWeekday(date)} ${formatDayMonth(date)}`;
  const weekGaps = week.reduce((n, d) => n + d.gapCount, 0);
  const paid = day.people.reduce((n, p) => n + p.shift.paidMinutes, 0);
  const unpaid = day.people.reduce((n, p) => n + p.shift.parts.reduce((m, x) => m + partPaid(x).unpaid, 0), 0);
  return (
    <div className="rota-plan">
      <PageHeader
        title={department ? `Plan: ${department.name}` : "Plan"}
        description={`${formatDateRange(monday, sunday)} at ${site.name}. ${share ? `Shared with staff by ${share.sharedByName}.` : "A draft: staff see it once you share the week."}`}
        status={department ? <Tag meta={ROTA_WEEK_META[share ? "shared" : "draft"]} /> : undefined}
        actions={department ? <>
          {departments.length > 1 ? <LinkPicker name="Department" options={departments.map((d) => ({ href: `/rota?${new URLSearchParams({ site: site.id, dept: d.id, week: monday })}`, label: d.name, current: d.id === department.id }))} /> : null}
          {data.canShare ? <CopyDialog siteId={site.id} departmentId={department.id} date={date} monday={monday}
            options={{ days: daysBack.map((d) => ({ iso: d, label: `${formatWeekday(d)} ${formatDayMonth(d)}` })), weeks: weeksBack.map((m) => ({ iso: m, label: m === addDaysIso(thisMonday, -7) ? "Last week" : `Week of ${formatDayMonth(m)}` })) }} /> : null}
          {data.canShare ? <Button asChild variant="outline"><a href={`/rota/export?${new URLSearchParams({ site: site.id, dept: department.id, week: monday })}`} download><Download aria-hidden="true" />Export week</a></Button> : null}
          {data.canShare && !share ? <ShareWeek siteId={site.id} departmentId={department.id} monday={monday} department={department.name} gaps={weekGaps} /> : null}
        </> : undefined}
      />
      {!department ? (
        <EmptyState as="h2" icon="calendarDays" title="No departments at this site" hint="An administrator adds them in Admin, Departments. Each activity on the rota belongs to one." />
      ) : (
        <>
          <div className="rota-bento">
            <section className="rota-shell rota-bento-week" aria-labelledby="rota-week">
              <div className="rota-core">
                <div className="rota-core-head">
                  <div className="flex min-w-0 flex-col gap-2">
                    <span className="rota-eyebrow">Week</span>
                    <h2 id="rota-week" className="rota-week-title tabular-nums">{formatDateRange(monday, sunday)}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rota-quiet tabular-nums">{weekGaps ? `${weekGaps} ${weekGaps === 1 ? "gap" : "gaps"}` : "No gaps"}</span>
                    <Button asChild variant="outline" size="icon" className="rota-round" aria-label="Previous week"><Link href={link({ week: addDaysIso(monday, -7) })}><ChevronLeft aria-hidden="true" /></Link></Button>
                    <Button asChild variant="outline" size="icon" className="rota-round" aria-label="Next week"><Link href={link({ week: addDaysIso(monday, 7) })}><ChevronRight aria-hidden="true" /></Link></Button>
                  </div>
                </div>
                <ul className="rota-week" aria-label="Days">
                  {week.map((d) => {
                    const state = !d.planned ? "empty" : d.gapCount ? "gaps" : "covered";
                    return (
                      <li key={d.iso}>
                        <Link className="rota-week-day" href={link({ day: d.iso })} aria-current={d.iso === date ? "date" : undefined} data-state={state} data-today={d.iso === now ? "" : undefined}
                          aria-label={`${formatWeekday(d.iso)} ${formatDayMonth(d.iso)}${d.iso === now ? ", today" : ""}: ${d.staff ? `${d.staff} staff, ${duration(d.paidMinutes)}` : "nobody added yet"}, ${!d.planned ? "nothing planned" : d.gapCount ? `${d.gapCount} ${d.gapCount === 1 ? "gap" : "gaps"}` : "covered"}`}>
                          <span className="rota-week-dow">{formatWeekday(d.iso, "short")}{d.iso === now ? <i>Today</i> : null}</span>
                          <span className="rota-week-num tabular-nums">{formatDayMonth(d.iso).split(" ")[0]}</span>
                          <small className="rota-week-sum">{d.staff ? `${d.staff} staff · ${duration(d.paidMinutes)}` : "Nobody yet"}</small>
                          <span className="rota-week-state">{!d.planned ? "Nothing planned" : d.gapCount ? `${d.gapCount} ${d.gapCount === 1 ? "gap" : "gaps"}` : "Covered"}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
            <section className="rota-shell rota-bento-day" aria-labelledby="rota-day">
              <div className="rota-core">
                <div className="flex flex-col gap-2">
                  <span className="rota-eyebrow">{formatWeekday(date)}{date === now ? " · today" : ""}</span>
                  <h2 id="rota-day" className="rota-day-title tabular-nums">{formatDayMonth(date)}</h2>
                  <div className="flex flex-wrap gap-2">
                    {day.groups.length ? <Tag meta={ROTA_DAY_META[dayGaps ? "gaps" : "covered"]} label={dayGaps ? `${dayGaps} ${dayGaps === 1 ? "gap" : "gaps"}` : "Everything is covered"} /> : null}
                    {warned ? <Tag meta={ROTA_SHIFT_NOTE_META.noBreak} label={`${warned} to check`} /> : null}
                  </div>
                </div>
                <dl className="rota-stats tabular-nums">
                  <div><dt>On today</dt><dd>{day.people.length}</dd></div>
                  <div><dt>Paid</dt><dd>{duration(paid)}</dd></div>
                  <div><dt>Unpaid breaks</dt><dd>{duration(unpaid)}</dd></div>
                  <div data-gaps={dayGaps ? "" : undefined}><dt>To fill</dt><dd>{dayGaps}</dd></div>
                </dl>
                {data.canChange ? (
                  <div className="rota-day-actions">
                    <span className="rota-wide-only"><AddShiftSheet siteId={site.id} departmentId={department.id} date={date} dateLabel={dateLabel} live={live} /></span>
                    {data.types.length ? <NeedDialog siteId={site.id} date={date} live={live} types={data.types} areas={data.areas} /> : null}
                  </div>
                ) : <p className="rota-quiet">{live ? "This day has come: the duty manager changes it from Today." : "You can see this plan. Planning it needs the Plan level for this department."}</p>}
              </div>
            </section>
          </div>
          <section className="rota-shell" aria-label={`${dateLabel}, the day plan`}>
            <div className="rota-core">
              {!day.groups.length && !day.people.length ? (
                <EmptyState compact icon="calendarDays" title={`Nothing planned for ${department.name} on ${dateLabel}`}
                  hint={data.types.length ? "Add staff to give people their shifts, add what the day needs, or copy an earlier day." : "Add this department's activities to the activity list first."} />
              ) : (
                <DayPlan siteId={site.id} departmentId={department.id} departmentNames={Object.fromEntries(departments.map((d) => [d.id, d.name]))} date={date} dateLabel={dateLabel} live={live}
                  canChange={data.canChange} zones={day.zones} groups={day.groups} allGroups={data.allGroups} people={day.people} hours={data.hours} types={data.types} areaList={data.areas} />
              )}
            </div>
          </section>
          {day.people.length || data.canChange ? (
            <section className="rota-shell rota-narrow-only" aria-labelledby="rota-working">
              <div className="rota-core">
              <div className="rota-core-head">
                <div><h2 id="rota-working">Who&apos;s working</h2>
                  <p className="text-sm text-ui-muted-foreground">Put people on a shift, then give them the day&apos;s activities. Breaks follow the handbook; you place them.</p></div>
                {data.canChange ? <AddShiftSheet siteId={site.id} departmentId={department.id} date={date} dateLabel={dateLabel} live={live} /> : null}
              </div>
              {day.people.length ? (
                <PeoplePlan people={day.people} siteId={site.id} departmentId={department.id} departmentNames={Object.fromEntries(departments.map((d) => [d.id, d.name]))} date={date} dateLabel={dateLabel} live={live} canChange={data.canChange} />
              ) : <EmptyState compact icon="users" title="Nobody on a shift yet" hint="Add someone to a shift, or put people straight on the activities above." />}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
