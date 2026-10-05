import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { CopyPlan, ShiftDialog } from "@/components/rota/actions";
import { RosterWeek, type RosterShiftDetail } from "@/components/rota/roster";
import { formatDateRange, formatDayMonth, formatWeekday, today } from "@/lib/format";
import { ACTIVITY_SUGGESTIONS, addDaysIso, weekStarted } from "@/lib/rota/constants";
import { rotaWeek } from "@/lib/rota/data";
import { buildRoster } from "@/lib/rota/roster";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: { absolute: "Week plan · Turnfin Rota" } };


/** One site's week as a roster sheet (owner decision, 3 October 2026):
 *  people down the side, days across. Department supervisors plan upcoming
 *  weeks here; once a week starts, each change asks for its reason
 *  (Timepoint already holds the week). */
export default async function WeekPlanPage({ searchParams }: { searchParams: Promise<{ site?: string; week?: string }> }) {
  const input = await searchParams;
  const data = await rotaWeek(input.site, input.week);
  const { site, monday } = data;
  const link = (week: string) => `/rota?${new URLSearchParams({ ...(site ? { site: site.id } : {}), week })}`;
  const sunday = addDaysIso(monday, 6);
  const now = today();
  const thisWeek = monday <= now && now <= sunday;
  const started = weekStarted(monday, now);
  const roster = buildRoster(data.days);
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
    <div className="space-y-4">
      <div className="module-heading">
        <div className="flex flex-wrap items-center gap-3">
          <h1>Week plan{site ? <span className="font-normal text-ui-muted-foreground">: {site.name}</span> : null}</h1>
          {site ? (
            <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold",
              started ? "bg-[var(--pc-warning-soft)] text-[var(--pc-warning)]" : "bg-[var(--pc-success-soft)] text-[var(--pc-success)]")}>
              {started ? "Under way · changes ask for a reason" : "Planning ahead · changes are free"}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {site ? (
            <nav aria-label="Weeks" className="flex items-center gap-1">
              <Button asChild variant="outline" size="icon" aria-label="Previous week"><Link href={link(addDaysIso(monday, -7))}><ChevronLeft aria-hidden="true" /></Link></Button>
              <span className="inline-flex min-h-11 items-center rounded-[var(--pc-radius-control)] border border-ui-border bg-ui-card px-3 text-sm font-semibold">{formatDateRange(monday, sunday)}</span>
              <Button asChild variant="outline" size="icon" aria-label="Next week"><Link href={link(addDaysIso(monday, 7))}><ChevronRight aria-hidden="true" /></Link></Button>
              {!thisWeek ? <Button asChild variant="ghost" className="min-h-11"><Link href={link(now)}>This week</Link></Button> : null}
            </nav>
          ) : null}
          {site?.manage && !started ? <CopyPlan siteId={site.id} to={monday} whole /> : null}
          {site?.manage ? <Button asChild variant="outline" className="min-h-11"><Link href={`/rota/bookings?site=${site.id}`}><CalendarRange aria-hidden="true" />Bookings</Link></Button> : null}
          {site?.manage ? <ShiftDialog siteId={site.id} date={thisWeek ? now : monday} today={now} options={options} /> : null}
        </div>
      </div>
      {data.sites.length === 0 || !site ? (
        <div className="module-empty"><CalendarDays aria-hidden="true" /><h2 className="font-semibold">No sites to show</h2><p className="mt-2 text-sm text-ui-muted-foreground">Your rota role does not cover a site yet.</p></div>
      ) : (
        <RosterWeek roster={roster} days={days} today={now} siteId={site.id} manage={site.manage} shifts={shifts} activities={activities} options={options}
          siteChooser={data.sites.length > 1 ? (
            <form key="site" method="get" className="flex min-w-0 items-center gap-2" aria-label="Choose a site">
              <div className="w-full sm:w-60"><NativeSelect name="site" defaultValue={site.id} aria-label="Site">
                {data.sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
              </NativeSelect></div>
              <input type="hidden" name="week" value={monday} />
              <Button type="submit" variant="outline">Show</Button>
            </form>
          ) : null} />
      )}
    </div>
  );
}
