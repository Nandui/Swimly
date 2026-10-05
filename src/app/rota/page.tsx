import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { CopyPlan, ShiftDialog } from "@/components/rota/actions";
import { LinkPicker } from "@/components/rota/link-picker";
import { RosterWeek, type RosterShiftDetail } from "@/components/rota/roster";
import { formatDateRange, formatDayMonth, formatWeekday, plural, today } from "@/lib/format";
import { ACTIVITY_SUGGESTIONS, WEEK_STATE_META, addDaysIso, mondayOf, weekStarted } from "@/lib/rota/constants";
import { rotaWeek } from "@/lib/rota/data";
import { buildRoster } from "@/lib/rota/roster";

export const metadata: Metadata = { title: "Week plan" };


/** One site's week as a roster sheet (owner decision, 3 October 2026):
 *  people down the side, days across. Department supervisors plan upcoming
 *  weeks here; once a week starts, each change asks for its reason
 *  (Timepoint already holds the week). */
export default async function WeekPlanPage({ searchParams }: { searchParams: Promise<{ site?: string; week?: string; dept?: string }> }) {
  const input = await searchParams;
  const data = await rotaWeek(input.site, input.week);
  const { site, monday } = data;
  const sunday = addDaysIso(monday, 6);
  const now = today();
  const thisWeek = monday <= now && now <= sunday;
  const started = weekStarted(monday, now);
  const roster = buildRoster(data.days);
  const dept = roster.groups.some((g) => g.key === input.dept) ? input.dept : undefined;
  const link = (week: string, department = dept) => `/rota?${new URLSearchParams({ ...(site ? { site: site.id } : {}), week, ...(department ? { dept: department } : {}) })}`;
  // Nearby weeks for the picker: always this week, and the one shown.
  const thisMonday = mondayOf(now);
  const nearby = [...new Set([-2, -1, 0, 1, 2, 3, 4].map((n) => addDaysIso(thisMonday, n * 7)).concat(monday))].sort();
  const weekName = (m: string) => m === thisMonday ? "This week" : m === addDaysIso(thisMonday, 7) ? "Next week" : m === addDaysIso(thisMonday, -7) ? "Last week" : `Week of ${formatDayMonth(m)}`;
  const t = roster.tiles;
  const counts = [plural(t.people, "person", "people") + " on the plan", t.toFill ? `${t.toFill} to fill` : null, t.offPeople ? `${t.offPeople} off` : null].filter(Boolean).join(" · ");
  const days = data.days.map((d) => ({ iso: d.iso, weekday: formatWeekday(d.iso, "short"), date: formatDayMonth(d.iso), today: d.iso === now }));
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Week plan"
        description={site ? <>
          {formatDateRange(monday, sunday)} · {site.name} · {counts}
          {site.manage ? <> <Tag meta={WEEK_STATE_META[started ? "underWay" : "planning"]} className="ml-1 align-middle" /></> : null}
        </> : undefined}
        actions={site ? <>
          <nav aria-label="Weeks" className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon" aria-label="Previous week"><Link href={link(addDaysIso(monday, -7))}><ChevronLeft aria-hidden="true" /></Link></Button>
            <LinkPicker name="Week" options={nearby.map((m) => ({ href: link(m), label: weekName(m), current: m === monday }))} />
            <Button asChild variant="outline" size="icon" aria-label="Next week"><Link href={link(addDaysIso(monday, 7))}><ChevronRight aria-hidden="true" /></Link></Button>
          </nav>
          {roster.groups.length > 1 ? (
            <LinkPicker name="Department" options={[{ href: link(monday, ""), label: "All", current: !dept },
              ...roster.groups.map((g) => ({ href: link(monday, g.key), label: g.label, current: g.key === dept }))]} />
          ) : null}
          {site.manage && !started ? <CopyPlan siteId={site.id} to={monday} whole /> : null}
          {site.manage ? <ShiftDialog siteId={site.id} date={thisWeek ? now : monday} today={now} options={options} /> : null}
        </> : undefined} />
      {data.sites.length === 0 || !site ? (
        <EmptyState as="h2" icon="calendarDays" title="No sites to show" hint="Your rota role does not cover a site yet." />
      ) : (
        <RosterWeek roster={{ ...roster, groups: roster.groups.filter((g) => !dept || g.key === dept) }} days={days} today={now} siteId={site.id} manage={site.manage}
          shifts={shifts} activities={activities} options={options} />
      )}
    </div>
  );
}
