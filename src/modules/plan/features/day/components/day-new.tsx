"use client";

import { useMemo } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { DayTimeline, type DayTimelineBlock, type DayTimelineLane } from "@/components/ui-kit/day-timeline";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { formatTime, formatTimeRange } from "@/lib/format";
import { dayByDepartment, shortByDepartment } from "@/modules/plan/features/day/by-department";
import { CopyDayButton } from "@/modules/plan/features/day/components/copy-day";
import { DayNav } from "@/modules/plan/features/day/components/day-nav";
import { useDayInspector } from "@/modules/plan/features/day/components/picked";
import type { PlanDayData } from "@/modules/plan/features/day/server/data";
import { ShiftDialog } from "@/modules/plan/shared/components/shift-dialog";

/** Day (new): the Day one department at a time, built from what the department needs (owner,
 *  17 November 2026). One timeline: what runs for hours on a line of its own, read as who is
 *  on it and where nobody is; bookings and lessons on one line; other work; then a line for each
 *  person in, with their whole shift. by-department.ts decides what sits where; the words are
 *  decided here. Everything opens in the Day's one inspector (picked.tsx), as on the Day. Phones
 *  read the same day as two lists, because a timeline that narrow cannot hold words. */
export function DayNewView({ data }: { data: PlanDayData }) {
  const inspector = useDayInspector(data);
  const { site, date, needs, shifts, duties, people } = data;
  // One department is always open: the one picked, else the first the person plans, else the first.
  const department = data.department ?? data.departments.mine[0] ?? data.departments.all[0] ?? null;
  const nameOf = (userId: string) => people.find((p) => p.id === userId)?.name ?? "Someone";
  const duty = (id: string | null) => (id ? duties.find((d) => d.id === id) : undefined);
  const dutyName = (id: string | null) => duty(id)?.name ?? "Work";
  const dutyDepartment = (id: string) => duty(id)?.departmentId ?? null;
  const link = (d: string, dept: string | null = department?.id ?? null) => `/plan/day-new?${new URLSearchParams({ site: site.id, date: d, ...(dept ? { dept } : {}) })}`;
  const isToday = date === data.today;
  const canAddShift = data.departments.mine.length > 0;

  const [from, to] = useMemo(() => {
    const spans = [...needs, ...shifts];
    if (!spans.length) return [6 * 60, 22 * 60];
    return [Math.floor(Math.min(...spans.map((s) => s.start)) / 60) * 60, Math.ceil(Math.max(...spans.map((s) => s.end)) / 60) * 60];
  }, [needs, shifts]);
  const hours = Array.from({ length: (to - from) / 60 + 1 }, (_, i) => ({ at: from + i * 60, label: formatTime(from + i * 60) }));

  if (!department) return <EmptyState icon="users" title="No departments yet" hint="An administrator adds departments in Admin, then people can be planned here." />;

  const short = shortByDepartment(data.departments.all.map((d) => d.id), needs, dutyDepartment);
  const day = dayByDepartment({ departmentId: department.id, needs, shifts, dutyDepartment, isBreak: (id) => Boolean(duty(id)?.isBreak) });
  const shortWords = (n: number) => (n > 1 ? `${n} short` : "Needs someone");

  const BOOKED = "booked";
  const OTHER = "other";
  const IN = "in";
  const lanes: DayTimelineLane[] = [];
  const blocks: DayTimelineBlock[] = [];
  for (const line of day.standing) {
    const lane = `n|${line.key}`;
    const what = `${dutyName(line.dutyId)}, ${line.label}`;
    lanes.push({ key: lane, label: what });
    for (const s of line.stretches) {
      const label = s.userId ? nameOf(s.userId) : s.short ? shortWords(s.short) : "Filled";
      blocks.push({ key: s.open, lane, start: s.start, end: s.end, kind: s.short ? "gap" : "ok", label, ariaLabel: `${what}, ${formatTimeRange(s.start, s.end)}: ${label}` });
    }
  }
  if (day.booked.length) lanes.push({ key: BOOKED, label: "Bookings and lessons" });
  for (const line of day.booked) for (const s of line.stretches) {
    const sub = s.userId ? nameOf(s.userId) : s.short ? shortWords(s.short) : "Filled";
    blocks.push({ key: s.open, lane: BOOKED, start: s.start, end: s.end, kind: s.short ? "gap" : "ok", label: line.label, sub, ariaLabel: `${line.label}, ${dutyName(line.dutyId)}, ${formatTimeRange(s.start, s.end)}: ${sub}` });
  }
  if (day.other.length) lanes.push({ key: OTHER, label: "Other work" });
  for (const w of day.other) {
    blocks.push({ key: w.open, lane: OTHER, start: w.start, end: w.end, kind: "ok", label: dutyName(w.dutyId), sub: nameOf(w.userId), ariaLabel: `${dutyName(w.dutyId)}, ${formatTimeRange(w.start, w.end)}: ${nameOf(w.userId)}` });
  }
  if (day.people.length) lanes.push({ key: IN, label: "Who is in" });
  for (const p of day.people) {
    const lane = `p|${p.shiftId}`;
    const name = nameOf(p.userId);
    lanes.push({ key: lane, label: name, under: IN });
    for (const st of p.stints) {
      const label = st.kind === "free" ? "Free" : st.kind === "class" ? "Teaching" : dutyName(st.dutyId);
      blocks.push({ key: st.open, lane, start: st.start, end: st.end, kind: st.kind === "free" ? "next" : st.kind === "break" ? "off" : st.kind === "class" ? "book" : "ok", label, sub: st.what ?? undefined,
        ariaLabel: `${name}, on shift ${formatTimeRange(p.start, p.end)}: ${[label, st.what].filter(Boolean).join(", ")}, ${formatTimeRange(st.start, st.end)}` });
    }
  }

  // The same day for phones: what still needs someone, then who is in and what they are on.
  const toFill = [...day.standing, ...day.booked].flatMap((line) => line.stretches.filter((s) => s.short > 0)
    .map((s) => ({ ...s, title: line.label, hint: `${dutyName(line.dutyId)} · ${shortWords(s.short)}` }))).sort((a, b) => a.start - b.start || a.end - b.end);
  const toCheck = shifts.filter((s) => s.departmentId === department.id && s.warnings.length);
  const nothing = lanes.length === 0;

  return (
    <div className="flex flex-col gap-(--space-7)">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DayNav date={date} today={data.today} href={(d) => link(d)} />
        <div className="flex flex-wrap items-center gap-2">
          {canAddShift && data.copyDays.length ? <CopyDayButton siteId={site.id} date={date} days={data.copyDays} /> : null}
          {canAddShift ? <ShiftDialog siteId={site.id} draft={{ userId: "", departmentId: (data.departments.mine.find((d) => d.id === department.id) ?? data.departments.mine[0])?.id ?? "", date, start: 7 * 60, end: 15 * 60, note: "" }}
            people={people} departments={data.departments.mine} trigger={<Button variant="outline" className="min-h-11"><UserPlus aria-hidden="true" />Add a shift</Button>} /> : null}
        </div>
      </div>

      {data.departments.all.length > 1 ? (
        <SegmentedLinks label="Department" items={data.departments.all.map((d) => ({ href: link(date, d.id), label: d.name, count: short.get(d.id) ? `${short.get(d.id)} to fill` : undefined, current: d.id === department.id }))} />
      ) : null}

      {data.classDutyId ? null : <Notice tone="info" title="Classes aren't shown yet" description="Mark one kind of work as the one classes need, in Setup, to see swim classes and plan their teachers here." />}
      {data.clashes.map((c) => <Notice key={`${c.a}${c.b}`} tone="warning" title={c.text} />)}

      <section aria-labelledby="plan-dept" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="plan-dept">What {department.name} needs, and who is in</h2>{nothing ? null : <p>{day.short ? `${day.short} to fill` : "All covered"}</p>}</div>
        {nothing ? <EmptyState compact icon="calendarDays" title={`Nothing is planned in ${department.name} this day`}
          hint={canAddShift ? "Add a shift, copy another day, or add activities and the staff they need in Setup." : "A manager adds activities, and the staff they need, in Setup."} /> : <>
          <div className="max-md:hidden"><div className="pc-panel">
            <DayTimeline from={from} to={to} now={isToday ? data.now : -1} nowLabel={formatTime(data.now)} hours={hours} lanes={lanes} blocks={blocks}
              label={`${department.name} at ${site.name}`} onSelect={inspector.pick} selected={inspector.pickedKey} labels="wide" />
          </div></div>
          <div className="flex flex-col gap-(--space-5) md:hidden">
            <section aria-label="Needs someone" className="flex min-w-0 flex-col">
              <div className="pc-section-head"><h3 className="font-semibold">Needs someone</h3>{toFill.length ? <p>{toFill.length}</p> : null}</div>
              {toFill.length === 0 ? <p className="pc-section-note">Everything {department.name} needs is covered.</p> : (
                <ul className="pc-list">
                  {toFill.map((r) => (
                    <li key={r.key} className="pc-row">
                      <span className="w-24 shrink-0 tabular-nums">{formatTimeRange(r.start, r.end)}</span>
                      <span className="pc-row-body"><span className="pc-row-title">{r.title}</span><span className="pc-row-hint" data-tone="orange">{r.hint}</span></span>
                      <Button className="min-h-11" aria-label={`Fill: ${r.title}, ${r.hint}, ${formatTimeRange(r.start, r.end)}`} onClick={() => inspector.pick(r.open)}>Fill</Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {day.people.map((p) => (
              <section key={p.shiftId} aria-label={nameOf(p.userId)} className="flex min-w-0 flex-col">
                <div className="pc-section-head"><h3 className="font-semibold">{nameOf(p.userId)}</h3><p>{formatTimeRange(p.start, p.end)}</p></div>
                <ul className="pc-list">
                  {p.stints.map((st) => {
                    const title = st.kind === "free" ? "Free" : st.kind === "class" ? "Teaching" : dutyName(st.dutyId);
                    return (
                      <li key={st.key} className="pc-row">
                        <span className="w-24 shrink-0 tabular-nums">{formatTimeRange(st.start, st.end)}</span>
                        <span className="pc-row-body"><span className="pc-row-title">{title}</span>{st.what ? <span className="pc-row-hint">{st.what}</span> : null}</span>
                        <Button variant="outline" className="min-h-11" aria-label={`Open: ${nameOf(p.userId)}, ${title}, ${formatTimeRange(st.start, st.end)}`} onClick={() => inspector.pick(st.open)}>Open</Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>}
      </section>

      {toCheck.length ? (
        <section aria-labelledby="plan-check" className="flex min-w-0 flex-col">
          <div className="pc-section-head"><h2 id="plan-check">To check</h2><p>{toCheck.length}</p></div>
          <ul className="pc-list">
            {toCheck.map((s) => (
              <li key={s.id} className="pc-row"><span className="pc-row-body"><span className="pc-row-title">{nameOf(s.userId)}</span>
                {s.warnings.map((w) => <span key={w} className="pc-row-hint" data-tone="orange">{w}</span>)}</span></li>
            ))}
          </ul>
        </section>
      ) : null}

      {inspector.node}
    </div>
  );
}
