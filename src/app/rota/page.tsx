import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { DayPlan } from "@/components/rota/day-plan";
import { LinkPicker } from "@/components/rota/link-picker";
import { CopyDialog, NeedDialog, ShareWeek } from "@/components/rota/plan-dialogs";
import { formatDateRange, formatDayMonth, formatWeekday, nameInitials } from "@/lib/format";
import { addDaysIso, clock, mondayOf } from "@/lib/rota/constants";
import { planWeek } from "@/lib/rota/data";
import type { Person } from "@/lib/rota/day";
import { ROTA_DAY_META, ROTA_FIT_META, ROTA_SHIFT_NOTE_META, ROTA_WEEK_META } from "@/lib/rota/meta";
import { duration } from "@/lib/rota/shifts";

export const metadata: Metadata = { title: "Plan" };

/** The department supervisor's Plan (owner decisions, 6 October 2026, from the approved mockup):
 *  one department's week at a site, a strip of its days with their gap counts, the open day as a
 *  timeline of its activities and who is on each place, and who is working with the shift that
 *  comes from it. A draft until the week is shared with its staff. */
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
  const warned = day.people.filter((p) => p.warnings.length || p.shift.parts.some((x) => x.unplaced.length)).length;
  const thisMonday = mondayOf(now);
  const weeksBack = Array.from({ length: 6 }, (_, i) => addDaysIso(monday, -7 * (i + 1)));
  const daysBack = Array.from({ length: 14 }, (_, i) => addDaysIso(date, -(i + 1)));
  const dateLabel = `${formatWeekday(date)} ${formatDayMonth(date)}`;
  return (
    <>
      <PageHeader
        title={department ? `Plan: ${department.name}` : "Plan"}
        description={`${formatDateRange(monday, sunday)} at ${site.name}. ${share ? `Shared with staff by ${share.sharedByName}.` : "A draft: staff see it once you share the week."}`}
        status={department ? <Tag meta={ROTA_WEEK_META[share ? "shared" : "draft"]} /> : undefined}
        actions={department ? <>
          {departments.length > 1 ? <LinkPicker name="Department" options={departments.map((d) => ({ href: `/rota?${new URLSearchParams({ site: site.id, dept: d.id, week: monday })}`, label: d.name, current: d.id === department.id }))} /> : null}
          {data.canShare ? <CopyDialog siteId={site.id} departmentId={department.id} date={date} monday={monday}
            options={{ days: daysBack.map((d) => ({ iso: d, label: `${formatWeekday(d)} ${formatDayMonth(d)}` })), weeks: weeksBack.map((m) => ({ iso: m, label: m === addDaysIso(thisMonday, -7) ? "Last week" : `Week of ${formatDayMonth(m)}` })) }} /> : null}
          {data.canShare && !share ? <ShareWeek siteId={site.id} departmentId={department.id} monday={monday} department={department.name} gaps={week.reduce((n, d) => n + d.gapCount, 0)} /> : null}
        </> : undefined}
      />
      {!department ? (
        <EmptyState as="h2" icon="calendarDays" title="No departments at this site" hint="Departments are set up under Admin. Each activity on the rota belongs to one." />
      ) : (
        <>
          <section className="pc-panel" aria-labelledby="rota-week">
            <div className="pc-panel-head">
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="icon" aria-label="Previous week"><Link href={link({ week: addDaysIso(monday, -7) })}><ChevronLeft aria-hidden="true" /></Link></Button>
                <h2 id="rota-week" className="tabular-nums">{formatDateRange(monday, sunday)}</h2>
                <Button asChild variant="outline" size="icon" aria-label="Next week"><Link href={link({ week: addDaysIso(monday, 7) })}><ChevronRight aria-hidden="true" /></Link></Button>
              </div>
              <span className="text-xs text-ui-muted-foreground">{week.reduce((n, d) => n + d.gapCount, 0)} gaps this week</span>
            </div>
            <ul className="rota-week" aria-label="Days">
              {week.map((d) => (
                <li key={d.iso}>
                  <Link className="rota-week-day" href={link({ day: d.iso })} aria-current={d.iso === date ? "date" : undefined}>
                    <span>{formatWeekday(d.iso, "short")} {formatDayMonth(d.iso).split(" ")[0]}{d.iso === now ? " · today" : ""}</span>
                    <Tag meta={ROTA_DAY_META[!d.planned ? "empty" : d.gapCount ? "gaps" : "covered"]}
                      label={d.planned && d.gapCount ? `${d.gapCount} ${d.gapCount === 1 ? "gap" : "gaps"}` : undefined} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="pc-panel" aria-labelledby="rota-day">
            <div className="pc-panel-head">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="rota-day">{formatWeekday(date)} {formatDayMonth(date)}</h2>
                {day.groups.length ? <Tag meta={ROTA_DAY_META[dayGaps ? "gaps" : "covered"]} label={dayGaps ? `${dayGaps} ${dayGaps === 1 ? "gap" : "gaps"}` : "Everything is covered"} /> : null}
                {warned ? <Tag meta={ROTA_SHIFT_NOTE_META.noBreak} label={`${warned} to check`} /> : null}
              </div>
              {data.canChange && data.types.length ? <NeedDialog siteId={site.id} date={date} live={live} types={data.types} places={data.places} /> : null}
            </div>
            {!data.canChange ? <p className="text-sm text-ui-muted-foreground">{live ? "This day has come: the duty manager changes it from Today." : "You can see this plan. Planning it needs the Plan level for this department."}</p> : null}
            {day.groups.length ? (
              <DayPlan siteId={site.id} date={date} dateLabel={dateLabel} live={live} canChange={data.canChange} groups={day.groups} types={data.types} places={data.places} />
            ) : (
              <EmptyState compact icon="calendarDays" title={`Nothing planned for ${department.name} on ${dateLabel}`}
                hint={data.types.length ? "Add the activities the day needs, or copy an earlier day." : "Add this department's activities to the activity list first."} />
            )}
          </section>
          {day.people.length ? (
            <section className="pc-panel" aria-labelledby="rota-working">
              <div className="pc-panel-head"><div><h2 id="rota-working">Who&apos;s working</h2>
                <p className="text-sm text-ui-muted-foreground">Each shift comes from the activities a person is on, with breaks placed by the handbook rules.</p></div></div>
              <ul className="pc-rows">{day.people.map((p) => <WorkingRow key={p.userId} person={p} />)}</ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

/** A person's day: their shift, what they are on, their breaks, and anything to check. */
function WorkingRow({ person: p }: { person: Person }) {
  const parts = p.shift.parts;
  const breaks = parts.flatMap((x) => x.breaks);
  const unplaced = parts.flatMap((x) => x.unplaced);
  return (
    <li className="pc-row">
      <Avatar size="lg"><AvatarFallback>{nameInitials(p.name)}</AvatarFallback></Avatar>
      <span className="pc-row-body">
        <span className="pc-row-title">{p.name}</span>
        <span className="pc-row-hint tabular-nums">
          {parts.length > 1 ? `${parts.map((x) => `${clock(x.start)} to ${clock(x.end)}`).join(" and ")}` : `Shift ${clock(p.shift.start)} to ${clock(p.shift.end)}`} · {duration(p.shift.paidMinutes)} paid · {p.activities.join(", ")}
        </span>
      </span>
      <span className="pc-row-trail">
        {parts.length > 1 ? <Tag meta={ROTA_SHIFT_NOTE_META.twoParts} /> : null}
        {breaks.map((b) => <Tag key={b.start} meta={ROTA_SHIFT_NOTE_META.break} label={`${b.paid ? "Paid break" : "Break"} ${clock(b.start)}–${clock(b.end)}`} />)}
        {unplaced.length ? <Tag meta={ROTA_SHIFT_NOTE_META.noBreak} label={`No room for ${unplaced.reduce((n, b) => n + b.minutes, 0)} min of breaks`} /> : null}
        {p.warnings.map((w) => <Tag key={w} meta={ROTA_FIT_META[w]} />)}
      </span>
    </li>
  );
}
