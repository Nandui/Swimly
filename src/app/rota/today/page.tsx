import type { Metadata } from "next";
import Link from "next/link";
import { Plus, UserX } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import {
  ABSENCE_REASON_META, type AbsenceReason, activityIcon, clock, dayGaps, DayNote, duration, fitsFor, NeedDialog, ROTA_CHANGE_REASON_META, ROTA_DAY_META, ROTA_TIMEPOINT_META, type RotaChangeReason, TimepointDone, todayAt, type TodayGap, TodayGaps,
} from "@/modules/rota/features/today";
import { formatDayMonth, formatWeekday, minutesNow } from "@/lib/format";

export const metadata: Metadata = { title: "Today" };

/** How many gaps get their best fits worked out on the page; the rest open "Everyone who could". */
const FITTED = 8;

/** The duty manager's Today (owner decisions, 6 October 2026, from the approved mockup): the
 *  whole site, every department. Gaps first, each with its best fits; then who is on now and
 *  next, who is off, today's changes with what is still to update in Timepoint, and the day note. */
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const input = await searchParams;
  const data = await todayAt(input.site);
  if (!data.site) {
    return (
      <>
        <PageHeader title="Today" />
        <EmptyState as="h2" icon="calendarDays" title="No sites to show" hint="Your rota role does not cover a site yet." />
      </>
    );
  }
  const { site, now, day, changes, note, off } = data;
  const nowMinutes = minutesNow();
  const run = site.run;
  const gaps = dayGaps(day).filter((g) => g.end > nowMinutes);
  const fitted: TodayGap[] = await Promise.all(gaps.map(async (g, i) => {
    const fits = run && i < FITTED ? (await fitsFor({ siteId: site.id, date: now, start: g.start, end: g.end, requiredTypeId: g.group.requiredTypeId })).filter((f) => !f.issues.includes("off") && f.userId !== g.off?.userId).slice(0, 3) : [];
    return {
      siteId: site.id, date: now, typeId: g.group.typeId, what: [g.group.name, g.group.place].filter(Boolean).join(" · "), dateLabel: "Today",
      start: g.start, end: g.end, requiredName: g.group.requiredName, needId: g.needId, place: g.place, classRefs: g.classRefs, icon: g.group.icon,
      replace: g.off ? { assignmentId: g.off.assignmentId, name: g.off.name } : null,
      why: [g.off ? `${g.off.name} is off` : "Nobody planned", g.count > 1 ? `${g.count} classes` : null, g.start <= nowMinutes ? "now" : `starts in ${duration(g.start - nowMinutes)}`].filter(Boolean).join(" · "),
      fits: fits.map((f) => ({ userId: f.userId, name: f.name, issues: f.issues, dayLength: f.dayLength,
        caption: `${f.day.length ? `On ${f.day[0].label} until ${clock(Math.max(...f.day.map((w) => w.end)))}` : "Free"} · ${f.weekMinutes ? `${duration(f.weekMinutes)} this week` : "no hours this week"}` })),
    };
  }));
  const blocks = day.groups.flatMap((g) => g.lanes.flat().map((b) => ({ ...b, group: g })));
  const onNow = day.groups.map((g) => ({ g, who: [...new Set(g.lanes.flat().filter((b) => b.kind === "on" && b.start <= nowMinutes && nowMinutes < b.end && !b.warnings.includes("off")).map((b) => b.name))] }))
    .filter((x) => x.who.length);
  const soon = blocks.filter((b) => b.start > nowMinutes && b.start <= nowMinutes + 180).sort((a, b) => a.start - b.start).slice(0, 8);
  const todo = changes.filter((c) => !c.timepointAt).length;
  const todayChanges = changes.filter((c) => c.date.toISOString().slice(0, 10) === now || !c.timepointAt);
  return (
    <>
      <PageHeader
        title={`Today: ${site.name}`}
        description={`${formatWeekday(now)} ${formatDayMonth(now)} · ${clock(nowMinutes)} · every department`}
        status={day.groups.length ? <Tag meta={ROTA_DAY_META[gaps.length ? "gaps" : "covered"]} label={gaps.length ? `${gaps.length} ${gaps.length === 1 ? "gap" : "gaps"}` : "No gaps left today"} /> : undefined}
        actions={run ? <>
          <Button asChild variant="outline"><Link href="/rota/absences?report=1"><UserX aria-hidden="true" />Report absence</Link></Button>
          {data.types.length ? <NeedDialog siteId={site.id} date={now} live types={data.types} places={data.places}
            trigger={<Button variant="outline"><Plus aria-hidden="true" />Add activity</Button>} /> : null}
        </> : undefined}
      />
      <section className="pc-panel" aria-labelledby="today-gaps">
        <div className="pc-panel-head"><div><h2 id="today-gaps">Gaps to fill</h2>
          <p className="text-sm text-ui-muted-foreground">{run ? "Best fits first. Putting someone on logs it as covering an absence, or filling a gap." : "The duty manager fills these."}</p></div></div>
        {gaps.length === 0 ? <EmptyState compact icon="calendarDays" title={day.groups.length ? "No gaps for the rest of today" : "Nothing is planned here today"} />
          : run ? <TodayGaps gaps={fitted} /> : (
            <ul className="pc-rows">{fitted.map((g, i) => {
              const Icon = activityIcon(g.icon);
              return <li key={i} className="pc-row"><span className="pc-tile-icon" aria-hidden="true"><Icon /></span><span className="pc-row-body"><span className="pc-row-title">{g.what}, {clock(g.start)} to {clock(g.end)}</span><span className="pc-row-hint">{g.why}</span></span></li>;
            })}</ul>
          )}
      </section>
      <div className="rota-two">
        <section className="pc-panel" aria-labelledby="today-now">
          <div className="pc-panel-head"><h2 id="today-now">On now · {clock(nowMinutes)}</h2><Button asChild variant="ghost"><Link href={`/rota?${new URLSearchParams({ site: site.id, day: now })}`}>Full day</Link></Button></div>
          {onNow.length === 0 ? <EmptyState compact icon="calendarDays" title="Nobody is on right now" /> : (
            <ul className="pc-rows">{onNow.map(({ g, who }) => {
              const Icon = activityIcon(g.icon);
              return <li key={g.key} className="pc-row"><span className="pc-tile-icon" aria-hidden="true"><Icon /></span>
                <span className="pc-row-body"><span className="pc-row-title">{[g.name, g.place].filter(Boolean).join(" · ")}</span><span className="pc-row-hint">{who.join(" · ")}</span></span></li>;
            })}</ul>
          )}
        </section>
        <section className="pc-panel" aria-labelledby="today-next">
          <div className="pc-panel-head"><h2 id="today-next">Coming up</h2></div>
          {soon.length === 0 ? <EmptyState compact icon="calendarDays" title="Nothing starts in the next three hours" /> : (
            <ul className="pc-rows">{soon.map((b, i) => (
              <li key={i} className="pc-row">
                <span className="pc-row-body"><span className="pc-row-title tabular-nums">{clock(b.start)}</span>
                  <span className="pc-row-hint">{[b.group.name, b.group.place].filter(Boolean).join(" · ")} · {b.kind === "gap" ? "Nobody yet" : `${b.name} starts`}</span></span>
                {b.kind === "gap" ? <Tag meta={ROTA_DAY_META.gaps} label="Gap" /> : null}
              </li>
            ))}</ul>
          )}
        </section>
        <section className="pc-panel" aria-labelledby="today-off">
          <div className="pc-panel-head"><h2 id="today-off">Off today</h2>{run ? <Button asChild variant="ghost"><Link href="/rota/absences">Absences</Link></Button> : null}</div>
          {off.length === 0 ? <EmptyState compact icon="calendarDays" title="Nobody is recorded as off" /> : (
            <ul className="pc-rows">{off.map((a) => (
              <li key={a.id} className="pc-row">
                <span className="pc-row-body"><span className="pc-row-title">{a.user?.name ?? "Someone"}</span>
                  <span className="pc-row-hint">{run ? `${ABSENCE_REASON_META[a.reason as AbsenceReason]?.label ?? "Off"} · ` : ""}{a.lastDay ? `back after ${formatDayMonth(a.lastDay.toISOString().slice(0, 10))}` : "no return date yet"} · reported by {a.reportedByName}</span></span>
              </li>
            ))}</ul>
          )}
        </section>
        <section className="pc-panel" aria-labelledby="today-changes">
          <div className="pc-panel-head"><h2 id="today-changes">Changes today</h2>{todo ? <Tag meta={ROTA_TIMEPOINT_META.todo} label={`${todo} to update in Timepoint`} /> : null}</div>
          {todayChanges.length === 0 ? <EmptyState compact icon="calendarDays" title="No changes yet today" /> : (
            <ul className="pc-rows">{todayChanges.map((c) => (
              <li key={c.id} className="pc-row">
                <span className="pc-row-body"><span className="pc-row-title">{c.summary}</span>
                  <span className="pc-row-hint">{clock(minutesNow(c.createdAt))} · {ROTA_CHANGE_REASON_META[c.reason as RotaChangeReason]?.label ?? c.reason}{c.note ? ` · ${c.note}` : ""} · by {c.byName}</span>
                  <span className="rota-tags"><Tag meta={ROTA_TIMEPOINT_META[c.timepointAt ? "done" : "todo"]} /></span></span>
                {!c.timepointAt && run ? <TimepointDone id={c.id} /> : null}
              </li>
            ))}</ul>
          )}
        </section>
      </div>
      <section className="pc-panel" aria-labelledby="today-note">
        <div className="pc-panel-head"><h2 id="today-note">Day note</h2><span className="text-xs text-ui-muted-foreground">Seen by every duty manager here today</span></div>
        {run ? <DayNote siteId={site.id} date={now} text={note?.text ?? ""} labelledBy="today-note" /> : <p>{note?.text || "No note today."}</p>}
      </section>
    </>
  );
}
