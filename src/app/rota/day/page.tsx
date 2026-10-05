import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, UserX } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { CopyPlan, ShiftDialog } from "@/components/rota/actions";
import { DayNote } from "@/components/rota/day-note";
import { DayPlanner } from "@/components/rota/day-planner";
import { LinkPicker } from "@/components/rota/link-picker";
import { ChangesToday } from "@/components/rota/changes-today";
import { WeekTabs } from "@/components/rota/week-tabs";
import { formatDay, formatDayMonth, minutesNow, today } from "@/lib/format";
import { addDaysIso, clock, mondayOf, weekStarted } from "@/lib/rota/constants";
import { rotaDay } from "@/lib/rota/data";

export const metadata: Metadata = { title: "This week" };

/** This week (owner decision, 5 October 2026): duty managers see every day of the week, a tab
 *  each, with everything on at the site, when and who, and change it there. The day is the
 *  shared planner (what needs people, who is on, and Needs you); today's tab
 *  adds the changes made to today's shifts. A department narrows it (`?dept=`). */
export default async function ThisWeekPage({ searchParams }: { searchParams: Promise<{ site?: string; date?: string; dept?: string }> }) {
  const input = await searchParams;
  const data = await rotaDay(input.site, input.date);
  const { site, day } = data;
  const now = today();
  const dept = data.departments.find((d) => d.id === input.dept) ?? null;
  const link = (date: string, department: string | null = dept?.id ?? null) => `/rota/day?${new URLSearchParams({ ...(site ? { site: site.id } : {}), date, ...(department ? { dept: department } : {}) })}`;
  const options = { people: data.people, types: data.types, departments: data.departments, duties: data.duties };
  const monday = mondayOf(day);
  const weekTitle = monday === mondayOf(now) ? "This week" : monday === mondayOf(addDaysIso(now, 7)) ? "Next week" : monday === mondayOf(addDaysIso(now, -7)) ? "Last week" : `Week of ${formatDayMonth(monday)}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={weekTitle}
        description={site ? `${site.name}${dept ? ` · ${dept.name}` : ""} · ${formatDay(day)}${day === now ? ` · ${clock(minutesNow())}, each change asks for its reason` : ""}` : undefined}
        actions={<>
          <nav aria-label="Weeks" className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon" aria-label="Previous week"><Link href={link(addDaysIso(monday, -7))}><ChevronLeft aria-hidden="true" /></Link></Button>
            <Button asChild variant="outline"><Link href={link(now)} aria-current={day === now ? "date" : undefined}>Today</Link></Button>
            <Button asChild variant="outline" size="icon" aria-label="Next week"><Link href={link(addDaysIso(monday, 7))}><ChevronRight aria-hidden="true" /></Link></Button>
          </nav>
          {data.departments.length ? (
            <LinkPicker name="Department" options={[{ href: link(day, null), label: "All", current: !dept },
              ...data.departments.map((d) => ({ href: link(day, d.id), label: d.name, current: d.id === dept?.id }))]} />
          ) : null}
          {site?.manage && day === now ? <Button asChild variant="outline"><Link href="/rota/absences?report=1"><UserX aria-hidden="true" />Report an absence</Link></Button> : null}
          {site?.manage && !weekStarted(day, now) ? <CopyPlan siteId={site.id} to={day} whole={false} /> : null}
          {site?.manage ? <ShiftDialog siteId={site.id} date={day} today={now} options={options} department={dept?.id} /> : null}
        </>} />
      {!site ? (
        <EmptyState as="h2" icon="calendarDays" title="No sites to show" hint="Your rota role does not cover a site yet." />
      ) : (
        <>
          <WeekTabs days={data.days} current={day} today={now} departmentId={dept?.id ?? null} href={(d) => link(d ?? day)} />
          <DayPlanner data={data} dept={dept} />
          {day === now ? <ChangesToday data={data} manage={site.manage} /> : null}
          <section aria-labelledby="day-notes" className="pc-panel">
            <h2 id="day-notes">Notes</h2>
            {site.manage ? <DayNote siteId={site.id} date={day} text={data.note} labelledBy="day-notes" />
              : <p className="whitespace-pre-line text-ui-muted-foreground">{data.note || "None."}</p>}
          </section>
        </>
      )}
    </div>
  );
}
