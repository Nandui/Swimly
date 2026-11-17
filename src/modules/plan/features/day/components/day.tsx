"use client";

import { useMemo } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { DayTimeline, type DayTimelineBlock, type DayTimelineLane } from "@/components/ui-kit/day-timeline";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { formatTime, formatTimeRange } from "@/lib/format";
import { dayByArea } from "@/modules/plan/features/day/by-area";
import { CopyDayButton } from "@/modules/plan/features/day/components/copy-day";
import { DayNav } from "@/modules/plan/features/day/components/day-nav";
import { useDayInspector } from "@/modules/plan/features/day/components/picked";
import type { PlanDayData } from "@/modules/plan/features/day/server/data";
import { offerLine } from "@/modules/plan/shared/cover";
import { tasksOf } from "@/modules/plan/shared/model";
import { ShiftDialog } from "@/modules/plan/shared/components/shift-dialog";

/** The Day, area by area on one timeline (owner, 16 November 2026: "person by person per area",
 *  and never two timelines to match up): each area heads its own rows, what's on there, what still
 *  needs someone, then a line for every person who works there with their time in that area. What
 *  belongs to no area (breaks, free time, a duty given by itself) comes last, a line per person.
 *  One inspector serves whichever block is picked (picked.tsx). Phones read the same day as
 *  lists, area by area, because a timeline that narrow cannot hold words. */
export function DayView({ data }: { data: PlanDayData }) {
  const inspector = useDayInspector(data);
  const { site, date, needs, shifts, duties, people, department } = data;
  // The people shown: every department's, or the one picked. What's on, and who could fill it, stay
  // the whole site's, because what's on belongs to an area and its duties, not to a department.
  const shown = department ? shifts.filter((s) => s.departmentId === department.id) : shifts;
  const nameOf = (userId: string) => people.find((p) => p.id === userId)?.name ?? "Someone";
  const duty = (id: string) => duties.find((d) => d.id === id);
  const shiftOf = (id: string) => shifts.find((s) => s.id === id);
  const link = (d: string, dept: string | null = department?.id ?? null) => `/plan/day?${new URLSearchParams({ site: site.id, date: d, ...(dept ? { dept } : {}) })}`;
  const isToday = date === data.today;
  const canAddShift = data.departments.mine.length > 0;

  const [from, to] = useMemo(() => {
    const spans = [...needs, ...shifts];
    if (!spans.length) return [6 * 60, 22 * 60];
    return [Math.floor(Math.min(...spans.map((s) => s.start)) / 60) * 60, Math.ceil(Math.max(...spans.map((s) => s.end)) / 60) * 60];
  }, [needs, shifts]);
  const hours = Array.from({ length: (to - from) / 60 + 1 }, (_, i) => ({ at: from + i * 60, label: formatTime(from + i * 60) }));

  // The one timeline (by-area.ts decides what sits where; the words are decided here). Every row
  // is also a line of `rows`, which phones read as lists under each area's name.
  const dutyName = (id: string | null) => (id ? duty(id)?.name : null) ?? "Duty";
  const byArea = dayByArea({ areas: data.areas, needs, shifts, shown, isBreak: (id) => Boolean(duty(id)?.isBreak) });
  const REST = "rest";
  const lanes: DayTimelineLane[] = [];
  const blocks: DayTimelineBlock[] = [];
  const sections: { key: string; label: string; note: string | null; rows: { key: string; start: number; end: number; title: string; hint: string; tone?: "orange"; open: string }[] }[] = [];
  for (const g of byArea.groups) {
    const head = `a|${g.key}`;
    const rows: (typeof sections)[number]["rows"] = [];
    lanes.push({ key: head, label: g.label });
    for (const i of g.items) {
      const sub = i.short ? `${i.short} short` : i.userIds.length ? i.userIds.map(nameOf).join(", ") : "Covered";
      blocks.push({ key: `item|${i.key}`, lane: head, start: i.start, end: i.end, kind: i.short ? "gap" : "ok", label: i.label, sub, ariaLabel: `${g.label}: ${i.label}, ${formatTimeRange(i.start, i.end)}: ${sub}` });
    }
    if (g.gaps.length) lanes.push({ key: `n|${g.key}`, label: "Needs someone", under: head });
    for (const x of g.gaps) {
      const key = `gap|${x.needKey}|${x.index}`;
      const what = `${dutyName(x.dutyId)} for ${x.label}`;
      // "Asked in Google Chat: 2 can cover", for each open request on this need (D31).
      const asked = data.cover.filter((r) => r.needKey === x.needKey).map((r) => `Asked in Google Chat: ${offerLine(r.answers).toLowerCase()}`);
      blocks.push({ key, lane: `n|${g.key}`, start: x.start, end: x.end, kind: "gap", label: dutyName(x.dutyId), sub: `${x.short} short`, ariaLabel: [`${g.label} needs someone: ${what}, ${formatTimeRange(x.start, x.end)}, ${x.short} short`, ...asked].join(". ") });
      rows.push({ key, start: x.start, end: x.end, title: "Needs someone", hint: [what, `${x.short} short`, ...asked].join(" · "), tone: "orange", open: key });
    }
    for (const p of g.people) {
      const lane = `p|${g.key}|${p.userId}`;
      const name = nameOf(p.userId);
      lanes.push({ key: lane, label: name, under: head });
      for (const st of p.stints) {
        // The tasks given in this duty are drawn inside its block, each where it starts and ends
        // (owner, 12 November 2026: "can the subtasks be shown in the timeline bar too?").
        const block = st.blockId ? shiftOf(st.shiftId ?? "")?.blocks.find((b) => b.id === st.blockId) : undefined;
        const given = block ? tasksOf(block, duty(block.dutyId)?.tasks ?? []) : [];
        const key = block && st.shiftId ? `block|${st.shiftId}|${block.id}` : `class|${st.itemKey}|${p.userId}`;
        const label = block ? dutyName(st.dutyId) : "Teaching";
        blocks.push({ key, lane, start: st.start, end: st.end, kind: block ? "ok" : "book", label, sub: st.what, parts: given.map((t) => ({ start: t.at, end: t.end, label: t.name })),
          ariaLabel: [`${g.label}, ${name}: ${label}, ${st.what}, ${formatTimeRange(st.start, st.end)}`, ...given.map((t) => `${t.name} ${formatTimeRange(t.at, t.end)}`)].join("; ") });
        rows.push({ key: `${key}|${st.start}`, start: st.start, end: st.end, title: name, hint: `${label} · ${st.what}`, open: key });
      }
    }
    sections.push({ key: g.key, label: g.label, note: g.short ? (g.short === 1 ? "1 needs someone" : `${g.short} need someone`) : null, rows: rows.sort((x, y) => x.start - y.start || x.end - y.end) });
  }
  if (byArea.rest.length) {
    const rows: (typeof sections)[number]["rows"] = [];
    lanes.push({ key: REST, label: "Not in an area" });
    for (const line of byArea.rest) {
      const lane = `r|${line.shiftId}`;
      const name = nameOf(line.userId);
      lanes.push({ key: lane, label: name, under: REST });
      for (const st of line.stints) {
        const key = st.blockId ? `block|${line.shiftId}|${st.blockId}` : `free|${line.shiftId}|${st.start}|${st.end}`;
        const label = st.kind === "free" ? "Free" : dutyName(st.dutyId);
        blocks.push({ key, lane, start: st.start, end: st.end, kind: st.kind === "free" ? "next" : st.kind === "break" ? "off" : "ok", label, ariaLabel: `${name}: ${label}, ${formatTimeRange(st.start, st.end)}` });
        rows.push({ key, start: st.start, end: st.end, title: name, hint: label, open: key });
      }
    }
    sections.push({ key: REST, label: "Not in an area", note: null, rows: rows.sort((x, y) => x.start - y.start || x.end - y.end) });
  }
  const needsSomeone = byArea.groups.reduce((sum, g) => sum + g.short, 0);

  const toCheck = shown.filter((s) => s.warnings.length);
  const tasks = shown.flatMap((s) => s.tasks.map((t) => ({ ...t, who: nameOf(s.userId) }))).sort((a, b) => a.at - b.at || a.end - b.end);

  return (
    <div className="flex flex-col gap-(--space-7)">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DayNav date={date} today={data.today} href={(d) => link(d)} />
        <div className="flex flex-wrap items-center gap-2">
        {canAddShift && data.copyDays.length ? <CopyDayButton siteId={site.id} date={date} days={data.copyDays} /> : null}
        {canAddShift ? <ShiftDialog siteId={site.id} draft={{ userId: "", departmentId: (data.departments.mine.find((d) => d.id === department?.id) ?? data.departments.mine[0])?.id ?? "", date, start: 7 * 60, end: 15 * 60, note: "" }}
          people={people} departments={data.departments.mine} trigger={<Button variant="outline" className="min-h-11"><UserPlus aria-hidden="true" />Add a shift</Button>} /> : null}
        </div>
      </div>

      {data.departments.all.length > 1 ? (
        <SegmentedLinks label="Department" items={[{ href: link(date, null), label: "All departments", current: !department },
          ...data.departments.all.map((d) => ({ href: link(date, d.id), label: d.name, current: d.id === department?.id }))]} />
      ) : null}

      {data.classDutyId ? null : <Notice tone="info" title="Classes aren't shown yet" description="Mark one duty as the one classes need, in Setup, to see swim classes and plan their teachers here." />}
      {data.clashes.map((c) => <Notice key={`${c.a}${c.b}`} tone="warning" title={c.text} />)}

      <section aria-labelledby="plan-on" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="plan-on">The day, area by area</h2>{needs.length ? <p>{needsSomeone ? `${needsSomeone} need someone` : "All covered"}</p> : null}</div>
        {lanes.length === 0 ? <EmptyState compact icon="calendarDays" title={department ? `Nothing is planned in ${department.name} this day` : "Nothing is planned this day"}
          hint={canAddShift ? "Add a shift, copy another day, or add what's on and the duties it needs in Setup." : "A manager adds what's on, and the duties it needs, in Setup."} /> : <>
          <div className="max-md:hidden"><div className="pc-panel">
            <DayTimeline from={from} to={to} now={isToday ? data.now : -1} nowLabel={formatTime(data.now)} hours={hours} lanes={lanes} blocks={blocks}
              label={`${site.name}, area by area`} onSelect={inspector.pick} selected={inspector.pickedKey} labels="wide" />
          </div></div>
          <div className="flex flex-col gap-(--space-5) md:hidden">
            {sections.map((sec) => (
              <section key={sec.key} aria-label={sec.label} className="flex min-w-0 flex-col">
                <div className="pc-section-head"><h3 className="font-semibold">{sec.label}</h3>{sec.note ? <p>{sec.note}</p> : null}</div>
                {sec.rows.length === 0 ? <p className="pc-section-note">Nobody is on here yet.</p> : (
                  <ul className="pc-list">
                    {sec.rows.map((r) => (
                      <li key={r.key} className="pc-row">
                        <span className="w-24 shrink-0 tabular-nums">{formatTimeRange(r.start, r.end)}</span>
                        <span className="pc-row-body"><span className="pc-row-title">{r.title}</span><span className="pc-row-hint" data-tone={r.tone}>{r.hint}</span></span>
                        <Button variant={r.tone ? "default" : "outline"} className="min-h-11" aria-label={`${r.tone ? "Fill" : "Open"}: ${r.title}, ${r.hint}, ${formatTimeRange(r.start, r.end)}`} onClick={() => inspector.pick(r.open)}>{r.tone ? "Fill" : "Open"}</Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </>}
      </section>

      <div className="grid gap-(--space-7) lg:grid-cols-2">
        <section aria-labelledby="plan-check" className="flex min-w-0 flex-col">
          <div className="pc-section-head"><h2 id="plan-check">To check</h2>{toCheck.length ? <p>{toCheck.length}</p> : null}</div>
          {toCheck.length === 0 ? <p className="pc-section-note">Nothing to check.</p> : (
            <ul className="pc-list">
              {toCheck.map((s) => (
                <li key={s.id} className="pc-row"><span className="pc-row-body"><span className="pc-row-title">{nameOf(s.userId)}</span>
                  {s.warnings.map((w) => <span key={w} className="pc-row-hint" data-tone="orange">{w}</span>)}</span></li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="plan-tasks" className="flex min-w-0 flex-col">
          <div className="pc-section-head"><h2 id="plan-tasks">Tasks</h2>{tasks.length ? <p>{tasks.length}</p> : null}</div>
          {tasks.length === 0 ? <p className="pc-section-note">No tasks given yet. Pick someone&apos;s duty in the timeline to choose its tasks and their times.</p> : (
            <ul className="pc-list">
              {tasks.map((t, i) => <li key={`${t.who}${t.name}${t.at}${i}`} className="pc-row"><span className="w-28 shrink-0 tabular-nums">{formatTimeRange(t.at, t.end)}</span>
                <span className="pc-row-body"><span className="pc-row-title">{t.name}</span><span className="pc-row-hint">{t.who}</span></span></li>)}
            </ul>
          )}
        </section>
      </div>

      {inspector.node}
    </div>
  );
}
