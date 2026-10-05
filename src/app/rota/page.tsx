import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { CopyPlan, ShiftDialog } from "@/components/rota/actions";
import { BookingDialog } from "@/components/rota/bookings";
import { DayPlanner } from "@/components/rota/day-planner";
import { LinkPicker } from "@/components/rota/link-picker";
import { WeekTabs } from "@/components/rota/week-tabs";
import { RosterWeek, type RosterCover, type RosterShiftDetail } from "@/components/rota/roster";
import { formatDateRange, formatDayMonth, formatWeekday, isDateOnly, today } from "@/lib/format";
import { ACTIVITY_SUGGESTIONS, WEEK_STATE_META, addDaysIso, mondayOf, weekStarted } from "@/lib/rota/constants";
import { rotaDay, rotaWeek } from "@/lib/rota/data";
import { buildRoster, forDepartment } from "@/lib/rota/roster";
import { buildTimeline } from "@/lib/rota/timeline";

export const metadata: Metadata = { title: "Week plan" };

/** Every department, for the picker's "All". */
const ALL = "all";

/** A department's week (owner decisions, 3 and 5 October 2026): the department supervisor plans
 *  their staff and bookings weeks ahead. The Week tab is the roster sheet: the department's staff
 *  down the side (shifts or not), days across, the department's activities and what is still to
 *  fill above them. Each day's tab (counting what needs sorting out) is the day planner: what
 *  needs people (every job and who is on it), a lane to drag new bookings onto in 15-minute
 *  steps, who is on shift, and Needs you. It opens on the viewer's own department; "All" shows every
 *  department. Once a week starts, each change asks for its reason (Timepoint holds the week). */
export default async function WeekPlanPage({ searchParams }: { searchParams: Promise<{ site?: string; week?: string; dept?: string; day?: string }> }) {
  const input = await searchParams;
  const day = input.day && isDateOnly(input.day) ? input.day : null;
  const dayData = day ? await rotaDay(input.site, day) : null;
  const data = dayData ?? await rotaWeek(input.site, input.week);
  const { site, monday } = data;
  const sunday = addDaysIso(monday, 6);
  const now = today();
  const thisWeek = monday <= now && now <= sunday;
  const started = weekStarted(monday, now);
  // The department shown: the one asked for, else the viewer's own; "all" for every department.
  const asked = input.dept === ALL ? null : data.departments.find((d) => d.id === (input.dept ?? data.mine)) ?? null;
  const dept = asked?.id;
  const whole = buildRoster(data.days, data.members, data.departments);
  const roster = asked ? forDepartment(whole, asked.id, data.members, asked.name) : whole;
  const link = (week: string, department: string = dept ?? ALL, date: string | null = null) => `/rota?${new URLSearchParams({ ...(site ? { site: site.id } : {}), week, dept: department, ...(date ? { day: date } : {}) })}`;
  // Moving week keeps the weekday open, so Tuesday stays Tuesday.
  const weekLink = (m: string) => link(m, dept ?? ALL, day ? addDaysIso(m, (Date.parse(day) - Date.parse(monday)) / 86_400_000) : null);
  const dayLink = (date: string) => link(monday, dept ?? ALL, date);
  // Nearby weeks for the picker: always this week, and the one shown.
  const thisMonday = mondayOf(now);
  const nearby = [...new Set([-2, -1, 0, 1, 2, 3, 4].map((n) => addDaysIso(thisMonday, n * 7)).concat(monday))].sort();
  const weekName = (m: string) => m === thisMonday ? "This week" : m === addDaysIso(thisMonday, 7) ? "Next week" : m === addDaysIso(thisMonday, -7) ? "Last week" : `Week of ${formatDayMonth(m)}`;
  const days = data.days.map((d) => ({ iso: d.iso, weekday: formatWeekday(d.iso, "short"), date: formatDayMonth(d.iso), today: d.iso === now, href: dayLink(d.iso) }));
  const shifts: Record<string, RosterShiftDetail> = Object.fromEntries(data.days.flatMap((d) => d.shifts.filter((s) => s.kind === "shift").map((s) => [s.id, {
    id: s.id, start: s.startMinutes, end: s.endMinutes, role: s.bookingNeed?.role ?? s.role, who: s.user?.name ?? s.rotaPerson?.name ?? null,
    segments: s.segments.map((g) => ({ start: g.startMinutes, end: g.endMinutes, kind: g.kind, label: g.label })),
    young: s.userId ? data.young[`${s.userId}:${d.iso}`] ?? null : null,
    date: s.date, startMinutes: s.startMinutes, endMinutes: s.endMinutes, note: s.note, userId: s.userId, requiredTypeId: s.requiredTypeId,
    departmentId: s.departmentId, department: s.department?.name ?? null, editable: !s.importId,
  } satisfies RosterShiftDetail])));
  const used = data.days.flatMap((d) => d.shifts.flatMap((s) => s.segments.filter((g) => g.kind === "activity").map((g) => g.label)));
  const activities = [...new Set([...used, ...ACTIVITY_SUGGESTIONS])];
  const options = { people: data.people, types: data.types, departments: data.departments, duties: data.duties };
  // Each day's activities to cover (the department's, or all of them), who is on each and its gaps.
  const cover: RosterCover[][] = data.days.map((d) => {
    const planned = d.planned.filter((a) => !dept || !a.departmentId || a.departmentId === dept);
    return buildTimeline(d.shifts, [], planned).cover.filter((c) => c.activity).map((c) => ({
      id: c.activity!.id, label: c.label, start: c.activity!.start, end: c.activity!.end, gaps: c.gaps.length,
      who: [...new Set(c.spans.map((x) => x.who))],
    }));
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Week plan"
        description={site ? `${formatDateRange(monday, sunday)} · ${site.name} · ${asked ? asked.name : "All departments"}` : undefined}
        status={site?.manage ? <Tag meta={WEEK_STATE_META[started ? "underWay" : "planning"]} /> : undefined}
        actions={site ? <>
          <nav aria-label="Weeks" className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon" aria-label="Previous week"><Link href={weekLink(addDaysIso(monday, -7))}><ChevronLeft aria-hidden="true" /></Link></Button>
            <LinkPicker name="Week" options={nearby.map((m) => ({ href: weekLink(m), label: weekName(m), current: m === monday }))} />
            <Button asChild variant="outline" size="icon" aria-label="Next week"><Link href={weekLink(addDaysIso(monday, 7))}><ChevronRight aria-hidden="true" /></Link></Button>
          </nav>
          {data.departments.length ? (
            <LinkPicker name="Department" options={[{ href: link(monday, ALL, day), label: "All", current: !asked },
              ...data.departments.map((d) => ({ href: link(monday, d.id, day), label: d.id === data.mine ? `${d.name} (yours)` : d.name, current: d.id === dept }))]} />
          ) : null}
          {site.manage && !started && !day ? <CopyPlan siteId={site.id} to={monday} whole /> : null}
          {site.manage && day && !weekStarted(day, now) ? <CopyPlan siteId={site.id} to={day} whole={false} /> : null}
          {/* A day's sections have their own Add buttons; the week adds from here. */}
          {site.manage && !day ? <BookingDialog siteId={site.id} today={now} departments={data.departments} types={data.types} department={dept} outline /> : null}
          {site.manage && !day ? <ShiftDialog siteId={site.id} date={thisWeek ? now : monday} today={now} options={options} department={dept} /> : null}
        </> : undefined} />
      {data.sites.length === 0 || !site ? (
        <EmptyState as="h2" icon="calendarDays" title="No sites to show" hint="Your rota role does not cover a site yet." />
      ) : (
        <>
          <WeekTabs days={data.days} current={day} today={now} departmentId={dept ?? null} href={(d) => (d ? dayLink(d) : link(monday))} week="Week" />
          {dayData ? <DayPlanner data={dayData} dept={asked} /> : (
            <RosterWeek roster={roster} days={days} today={now} siteId={site.id} manage={site.manage} department={dept}
              shifts={shifts} activities={activities} options={options} cover={cover} />
          )}
        </>
      )}
    </div>
  );
}
