import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { formatDateRange, formatDayMonth, formatWeekday } from "@/lib/format";
import { addDaysIso, CopyWeek, DepartmentMenu, Diary, diaryWeek, EVERY_DEPARTMENT, mondayOf, ROTA_WEEK_META, ShareWeekDialog } from "@/modules/rota/features/diary";

export const metadata: Metadata = { title: "Plan" };

/** The department supervisor's Plan, as the day's diary (owner, 20 October 2026), laid out as the
 *  approved Turnfin Glass canvas draws it: the title, the department as a menu and the day in the
 *  line under it, the day's figures (places to fill, people on, hours) beside it; the week as a
 *  strip of days; then what is not covered yet, who's where and the day person by person. The week
 *  exports to Excel for Timepoint and is a draft until shared with its staff. */
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ site?: string; dept?: string; day?: string }> }) {
  const data = await diaryWeek(await searchParams);
  if (!data.site || !("diary" in data)) {
    return (
      <PageShell header={<PageHeader title="Plan" />}>
        <EmptyState as="h2" icon="calendarDays" title="No sites to show" hint="Your rota role does not cover a site yet." />
      </PageShell>
    );
  }
  const { site, date, now, monday, department, departments, every, share, week, diary } = data;
  const deptParam = every ? EVERY_DEPARTMENT : department?.id;
  const link = (day: string, dept = deptParam) => `/rota?${new URLSearchParams({ site: site.id, ...(dept ? { dept } : {}), day })}`;
  const today = date === now;
  const dateLabel = `${formatWeekday(date)} ${formatDayMonth(date)}`;
  const weekHoles = week.reduce((n, d) => n + d.holes, 0);
  const departmentNames = Object.fromEntries(departments.map((d) => [d.id, d.name]));
  const thisMonday = mondayOf(now);
  const on = diary.people.filter((p) => !p.off);
  const hours = Math.round(on.reduce((sum, p) => sum + p.paidMinutes, 0) / 30) / 2;
  const deptName = every ? "Every department" : department?.name ?? null;
  const state = !department ? null : share ? `shared with staff by ${share.sharedByName}` : "a draft until you share the week";
  const description = (
    <>
      {departments.length > 1 && deptName ? (
        <DepartmentMenu current={deptName} items={[
          ...departments.map((d) => ({ href: link(date, d.id), label: d.name, current: !every && d.id === department?.id })),
          { href: link(date, EVERY_DEPARTMENT), label: "Every department", current: every },
        ]} />
      ) : deptName ?? site.name}
      {` · ${dateLabel}${today ? ", today" : ""}`}
      {state ? ` · ${state}` : every ? " · choose one department to copy, export or share its week" : ""}
    </>
  );
  return (
    <PageShell className="diary-page" spacing="roomy" header={<PageHeader
        title="Plan"
        description={description}
        status={department ? <Tag meta={ROTA_WEEK_META[share ? "shared" : "draft"]} /> : undefined}
        actions={department && data.canShare ? <>
          <CopyWeek siteId={site.id} departmentId={department.id} date={date} monday={monday}
            days={Array.from({ length: 14 }, (_, i) => addDaysIso(date, -(i + 1))).map((d) => ({ iso: d, label: `${formatWeekday(d)} ${formatDayMonth(d)}` }))}
            weeks={Array.from({ length: 6 }, (_, i) => addDaysIso(monday, -7 * (i + 1))).map((m) => ({ iso: m, label: m === addDaysIso(thisMonday, -7) ? "Last week" : `Week of ${formatDayMonth(m)}` }))} />
          <Button asChild variant="outline"><a href={`/rota/export?${new URLSearchParams({ site: site.id, dept: department.id, week: monday })}`} download><Download aria-hidden="true" />Export week</a></Button>
          {!share ? <ShareWeekDialog siteId={site.id} departmentId={department.id} monday={monday} department={department.name} holes={weekHoles} /> : null}
        </> : undefined}
      />}>
      {!departments.length ? (
        <EmptyState as="h2" icon="calendarDays" title="No departments at this site" hint="An administrator adds them in Admin, Departments. Each activity on the rota belongs to one." />
      ) : (
        <>
          <dl className="rota-figures" aria-label={`${dateLabel} in figures`}>
            <div data-tone={diary.holes.length ? "orange" : undefined}><dt>to fill</dt><dd>{diary.holes.length}</dd></div>
            <div><dt>{on.length === 1 ? "person on" : "people on"}</dt><dd>{on.length}</dd></div>
            <div><dt>{hours === 1 ? "hour" : "hours"}</dt><dd>{hours}</dd></div>
          </dl>
          <nav className="rota-week" aria-label={`Week of ${formatDateRange(monday, addDaysIso(monday, 6))}`}>
            <Button asChild variant="outline" size="icon" aria-label="Previous week"><Link href={link(addDaysIso(date, -7))}><ChevronLeft aria-hidden="true" /></Link></Button>
            <ol className="rota-days">
              {week.map((d) => {
                const status = d.holes ? `${d.holes} to fill` : d.people ? "Done" : "Nothing yet";
                return (
                  <li key={d.date}>
                    <Link href={link(d.date)} className="rota-day" aria-current={d.date === date ? "date" : undefined} data-today={d.date === now ? "" : undefined}
                      aria-label={`${formatWeekday(d.date)} ${formatDayMonth(d.date)}${d.date === now ? ", today" : ""}: ${status}`}>
                      <span className="rota-day-name">{formatWeekday(d.date, "short")}</span>
                      <span className="rota-day-number">{formatDayMonth(d.date).split(" ")[0]}</span>
                      <span className="rota-day-status" data-tone={d.holes ? "orange" : undefined}>{d.holes ? `${d.holes} to fill` : d.people ? "Done" : "—"}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            <Button asChild variant="outline" size="icon" aria-label="Next week"><Link href={link(addDaysIso(date, 7))}><ChevronRight aria-hidden="true" /></Link></Button>
            {mondayOf(date) !== thisMonday || !today ? <Button asChild variant="ghost" className="rota-week-today"><Link href={link(now)}>Today</Link></Button> : null}
          </nav>
          {!data.canChange ? (
            <Notice title={data.blocked === "come" ? "This day has come: the duty manager changes it from Today."
              : data.blocked === "member" ? `You plan only the departments you belong to${department ? `, and ${department.name} is not one of yours` : ""}. An administrator ticks yours under Departments on your profile in HR, People.`
              : "You can see this plan. Planning it needs the Plan level for Rota in your role."} />
          ) : null}
          <Diary siteId={site.id} date={date} dateLabel={dateLabel} today={today} live={date <= now} canChange={data.canChange}
            departmentId={department?.id ?? null} departmentFor={data.departmentFor} diary={diary} hours={data.hours} pool={data.pool}
            departmentNames={departmentNames} types={data.types} activities={data.activities} areas={data.areas} subActivities={data.subActivities} />
        </>
      )}
    </PageShell>
  );
}
