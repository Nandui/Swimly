import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { formatDateRange, formatDayMonth, formatWeekday } from "@/lib/format";
import { addDaysIso, CopyWeek, Diary, diaryWeek, EVERY_DEPARTMENT, mondayOf, ROTA_DAY_META, ROTA_WEEK_META, ShareWeekDialog } from "@/modules/rota/features/diary";

export const metadata: Metadata = { title: "Plan" };

/** The department supervisor's Plan, as the day's diary (owner, 20 October 2026): it opens on
 *  their own department's day, shows what is not covered yet first, who's where at a moment, then
 *  the day person by person. A week's days sit in one bar under the title; the week exports to
 *  Excel for Timepoint and is a draft until shared with its staff. */
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
  return (
    <PageShell className="diary-page" spacing="roomy" header={<PageHeader
        title={every ? "Plan: every department" : department ? `Plan: ${department.name}` : "Plan"}
        description={`${site.name} · ${every ? "every department together. Choose one to copy, export or share its week." : share ? `shared with staff by ${share.sharedByName}.` : "a draft until you share the week with staff."}`}
        status={department ? <Tag meta={ROTA_WEEK_META[share ? "shared" : "draft"]} /> : undefined}
        actions={department && data.canShare ? <>
          <CopyWeek siteId={site.id} departmentId={department.id} date={date} monday={monday}
            days={Array.from({ length: 14 }, (_, i) => addDaysIso(date, -(i + 1))).map((d) => ({ iso: d, label: `${formatWeekday(d)} ${formatDayMonth(d)}` }))}
            weeks={Array.from({ length: 6 }, (_, i) => addDaysIso(monday, -7 * (i + 1))).map((m) => ({ iso: m, label: m === addDaysIso(thisMonday, -7) ? "Last week" : `Week of ${formatDayMonth(m)}` }))} />
          <Button asChild variant="outline"><a href={`/rota/export?${new URLSearchParams({ site: site.id, dept: department.id, week: monday })}`} download><Download aria-hidden="true" />Export week</a></Button>
          {!share ? <ShareWeekDialog siteId={site.id} departmentId={department.id} monday={monday} department={department.name} holes={weekHoles} /> : null}
        </> : undefined}
      />}>
      {departments.length > 1 ? (
        <SegmentedLinks label="Department" items={[
          ...departments.map((d) => ({ href: link(date, d.id), label: d.name, current: !every && d.id === department?.id })),
          { href: link(date, EVERY_DEPARTMENT), label: "Every department", current: every },
        ]} />
      ) : null}
      {!departments.length ? (
        <EmptyState as="h2" icon="calendarDays" title="No departments at this site" hint="An administrator adds them in Admin, Departments. Each activity on the rota belongs to one." />
      ) : (
        <>
          <nav className="diary-week" aria-label="Days of the week">
            <Button asChild variant="outline" size="icon" className="size-11" aria-label="Previous week"><Link href={link(addDaysIso(date, -7))}><ChevronLeft aria-hidden="true" /></Link></Button>
            <span className="diary-week-range tabular-nums">{formatDateRange(monday, addDaysIso(monday, 6))}</span>
            <Button asChild variant="outline" size="icon" className="size-11" aria-label="Next week"><Link href={link(addDaysIso(date, 7))}><ChevronRight aria-hidden="true" /></Link></Button>
            {!today ? <Button asChild variant="ghost"><Link href={link(now)}>Today</Link></Button> : null}
            <SegmentedLinks label="Day" className="diary-days" items={week.map((d) => ({
              href: link(d.date),
              label: `${formatWeekday(d.date, "short")} ${formatDayMonth(d.date).split(" ")[0]}${d.date === now ? " (today)" : ""}`,
              count: d.holes ? `${d.holes} to fill` : d.people ? "Done" : "—",
              current: d.date === date,
            }))} />
          </nav>
          <section className="diary-dayhead" aria-labelledby="diary-date">
            <h2 id="diary-date" className="diary-date">{dateLabel}{today ? ", today" : ""}</h2>
            <Tag meta={ROTA_DAY_META[!diary.needs.length && !diary.people.length ? "empty" : diary.done ? "covered" : "gaps"]}
              label={!diary.needs.length && !diary.people.length ? undefined : diary.done ? "Every need filled" : `${diary.holes.length} not covered`} />
          </section>
          {!data.canChange ? (
            <Notice title={data.blocked === "come" ? "This day has come: the duty manager changes it from Today."
              : data.blocked === "member" ? `You plan only the departments you belong to${department ? `, and ${department.name} is not one of yours` : ""}. An administrator ticks yours under Departments on your profile in HR, People.`
              : "You can see this plan. Planning it needs the Plan level for Rota in your role."} />
          ) : null}
          <Diary siteId={site.id} date={date} dateLabel={dateLabel} today={today} live={date <= now} canChange={data.canChange}
            departmentId={department?.id ?? null} departmentFor={data.departmentFor} diary={diary} hours={data.hours} pool={data.pool}
            departmentNames={departmentNames} types={data.types} areas={data.areas} subActivities={data.subActivities} />
        </>
      )}
    </PageShell>
  );
}
