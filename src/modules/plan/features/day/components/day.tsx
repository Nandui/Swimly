"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { DayTimeline, type DayTimelineBlock, type DayTimelineLane } from "@/components/ui-kit/day-timeline";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Inspector } from "@/components/ui-kit/inspector";
import { Notice } from "@/components/ui-kit/notice";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { toast } from "@/components/ui/toast";
import { formatDay, formatTime, formatTimeRange } from "@/lib/format";
import { dayByArea } from "@/modules/plan/features/day/by-area";
import { BlockDialog } from "@/modules/plan/features/day/components/block-dialog";
import { CopyDayButton } from "@/modules/plan/features/day/components/copy-day";
import { AskCoverDialog, CoverAnswers } from "@/modules/plan/features/day/components/cover";
import { SessionDayDialog } from "@/modules/plan/features/day/components/session-day";
import { planClassTeacher, removeBlock, saveBlock } from "@/modules/plan/features/day/server/actions";
import { chooseCover, stopAsking } from "@/modules/plan/features/day/server/cover-actions";
import type { PlanDayData } from "@/modules/plan/features/day/server/data";
import { BlockTasks } from "@/modules/plan/features/day/components/task-ticks";
import { lanesLabel } from "@/lib/setup/lanes";
import { offerLine, openRequestFor } from "@/modules/plan/shared/cover";
import { shiftIso, tasksOf, type BlockTask } from "@/modules/plan/shared/model";
import { RemoveShiftDialog, ShiftDialog } from "@/modules/plan/shared/components/shift-dialog";

type Picked = { kind: "item"; key: string } | { kind: "gap"; needKey: string; index: number }
  | { kind: "block"; shiftId: string; blockId: string } | { kind: "free"; shiftId: string; start: number; end: number };

/** The Day, area by area on one timeline (owner, 16 November 2026: "person by person per area",
 *  and never two timelines to match up): each area heads its own rows, what's on there, what still
 *  needs someone, then a line for every person who works there with their time in that area. What
 *  belongs to no area (breaks, free time, a duty given by itself) comes last, a line per person.
 *  One inspector serves whichever block is picked: a thing on and its places, who could fill a gap,
 *  a duty to change and its tasks to give, free time to give a duty. Phones read the same day as
 *  lists, area by area, because a timeline that narrow cannot hold words. */
export function DayView({ data }: { data: PlanDayData }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [pending, start] = useTransition();
  const dateInput = useRef<HTMLInputElement>(null);
  const { site, date, needs, shifts, duties, people, occurrences, department } = data;
  // The people shown: every department's, or the one picked. What's on, and who could fill it, stay
  // the whole site's, because what's on belongs to an area and its duties, not to a department.
  const shown = department ? shifts.filter((s) => s.departmentId === department.id) : shifts;
  const nameOf = (userId: string) => people.find((p) => p.id === userId)?.name ?? "Someone";
  const duty = (id: string) => duties.find((d) => d.id === id);
  const shiftOf = (id: string) => shifts.find((s) => s.id === id);
  const blockOwner = new Map(shifts.flatMap((s) => s.blocks.map((b) => [b.id, s] as const)));
  const sessionTitle = (id: string | null) => occurrences.find((o) => o.sessionId === id)?.title ?? null;
  const link = (d: string, dept: string | null = department?.id ?? null) => `/plan/day?${new URLSearchParams({ site: site.id, date: d, ...(dept ? { dept } : {}) })}`;
  const isToday = date === data.today;
  const canAddShift = data.departments.mine.length > 0;
  const sessionOptions = occurrences.map((o) => ({ id: o.sessionId, title: o.title, start: o.start, end: o.end, dutyIds: o.needs.map((n) => n.dutyId) }));
  const dutyOptions = duties.map((d) => ({ id: d.id, name: d.name, isBreak: d.isBreak, defaultMinutes: d.defaultMinutes, tasks: d.tasks }));

  const [from, to] = useMemo(() => {
    const spans = [...needs, ...shifts];
    if (!spans.length) return [6 * 60, 22 * 60];
    return [Math.floor(Math.min(...spans.map((s) => s.start)) / 60) * 60, Math.ceil(Math.max(...spans.map((s) => s.end)) / 60) * 60];
  }, [needs, shifts]);
  const hours = Array.from({ length: (to - from) / 60 + 1 }, (_, i) => ({ at: from + i * 60, label: formatTime(from + i * 60) }));

  // Each thing on (a session with all its duties, or a class): the Inspector lists everyone on it.
  const fillerOf = (f: { userId?: string; blockId?: string }) => f.userId ?? (f.blockId ? blockOwner.get(f.blockId)?.userId : undefined);
  const items = (() => {
    const byKey = new Map<string, { key: string; label: string; where: string; areaId: string | null; lanes: readonly number[]; start: number; end: number; sessionId: string | null; needs: typeof needs }>();
    for (const n of needs) {
      const key = n.sessionId ? `s:${n.sessionId}` : n.key;
      const item = byKey.get(key) ?? { key, label: n.label, where: n.where, areaId: n.placeAreaId, lanes: n.placeLanes, start: n.start, end: n.end, sessionId: n.sessionId, needs: [] };
      item.needs.push(n);
      byKey.set(key, item);
    }
    return [...byKey.values()].map((item) => ({ ...item,
      // "Main Pool, lanes 1 to 3" for a session that names its lanes; a class's place says them already.
      place: item.sessionId && item.lanes.length ? `${item.where}, ${lanesLabel(item.lanes, data.areas.find((a) => a.id === item.areaId)?.lanes ?? 0).toLowerCase()}` : item.where,
    }));
  })();

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

  function pick(key: string) {
    const parts = key.split("|");
    const kind = parts[0];
    if (kind === "item") setPicked({ kind, key: parts.slice(1).join("|") });
    else if (kind === "class") setPicked({ kind: "item", key: parts.slice(1, -1).join("|") });
    else if (kind === "gap") setPicked({ kind, needKey: parts.slice(1, -1).join("|"), index: Number(parts[parts.length - 1]) });
    else if (kind === "block") setPicked({ kind, shiftId: parts[1], blockId: parts[2] });
    else if (kind === "free") setPicked({ kind, shiftId: parts[1], start: Number(parts[2]), end: Number(parts[3]) });
  }
  const close = () => setPicked(null);
  const run = (work: () => Promise<{ ok: boolean; error?: string }>, done: string) => start(async () => {
    const result = await work();
    if (!result.ok) { toast.error(result.error ?? "That didn't save."); return; }
    toast.success(done); close(); router.refresh();
  });
  /** Give one duty block its tasks and their times, from the duty's list; the block stays open. */
  const giveTasks = (block: { id: string; shiftId: string; dutyId: string; sessionId: string | null; start: number; end: number }, tasks: BlockTask[]) => start(async () => {
    const result = await saveBlock({ shiftId: block.shiftId, dutyId: block.dutyId, sessionId: block.sessionId, start: block.start, end: block.end, tasks }, block.id);
    if (!result.ok) { toast.error(result.error ?? "That didn't save."); return; }
    toast.success("Tasks saved"); router.refresh();
  });

  const pickedKey = !picked ? null : picked.kind === "item" ? `item|${picked.key}` : picked.kind === "gap" ? `gap|${picked.needKey}|${picked.index}`
    : picked.kind === "block" ? `block|${picked.shiftId}|${picked.blockId}` : `free|${picked.shiftId}|${picked.start}|${picked.end}`;
  const inspector = (() => {
    if (!picked) return null;
    if (picked.kind === "item") {
      const item = items.find((i) => i.key === picked.key);
      if (!item) return null;
      const occurrence = occurrences.find((o) => o.sessionId === item.sessionId);
      return { title: item.label, description: `${item.place} · ${formatTimeRange(item.start, item.end)}`,
        body: (
          <div className="flex flex-col gap-(--space-5)">
            {item.needs.map((n) => (
              <section key={n.key} aria-label={duty(n.dutyId)?.name ?? "Duty"} className="flex flex-col gap-1">
                <h3 className="font-semibold">{duty(n.dutyId)?.name ?? "Duty"}{n.count > 1 ? ` × ${n.count}` : ""}</h3>
                <ul className="pc-list">
                  {n.fills.map((f, i) => {
                    const who = fillerOf(f);
                    const owner = f.blockId ? blockOwner.get(f.blockId) : undefined;
                    return (
                      <li key={f.blockId ?? f.userId ?? i} className="pc-row">
                        <span className="pc-row-body"><span className="pc-row-title">{who ? nameOf(who) : "Filled"}</span><span className="pc-row-hint">{formatTimeRange(f.start, f.end)}</span></span>
                        {n.kind === "class"
                          ? <Button variant="ghost" className="min-h-11" disabled={pending} onClick={() => run(() => planClassTeacher({ source: n.source!, ref: n.classRef!, siteId: site.id, date, userId: null }), "Teacher taken off")}>Take off</Button>
                          : owner?.canPlan && f.blockId ? <Button variant="ghost" className="min-h-11" disabled={pending} onClick={() => run(() => removeBlock(f.blockId!), "Taken off")}>Take off</Button> : null}
                      </li>
                    );
                  })}
                  {n.gaps.map((g, i) => (
                    <li key={`gap${i}`} className="pc-row">
                      <span className="pc-row-body"><span className="pc-row-title">{g.short} short</span><span className="pc-row-hint" data-tone="orange">{formatTimeRange(g.start, g.end)}</span></span>
                      <Button className="min-h-11" onClick={() => setPicked({ kind: "gap", needKey: n.key, index: i })}>Fill</Button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {item.needs.some((n) => n.kind === "class") ? <p className="text-sm text-ui-muted-foreground">Swim school keeps who teaches each class; changing it here changes it there.</p> : null}
          </div>
        ),
        actions: data.manage && occurrence ? <SessionDayDialog sessionId={occurrence.sessionId} title={occurrence.title} date={date} start={occurrence.start} end={occurrence.end} /> : null };
    }
    if (picked.kind === "gap") {
      const need = needs.find((n) => n.key === picked.needKey);
      if (!need) return null;
      const dutyName = duty(need.dutyId)?.name ?? "Duty";
      {
        const gap = need.gaps[picked.index];
        // A class has one teacher for all of it; anything else can be filled in parts.
        const candidates = (data.candidates[`${need.key}#${picked.index}`] ?? []).filter((c) => need.kind !== "class" || c.whole);
        if (!gap) return null;
        // Asking staff who are not working then (D31): one open request for a stretch, its answers
        // here, and Ask for the departments that can be asked (the duty's own, or any of mine).
        const request = openRequestFor(data.cover, need.key, gap);
        const dutyDepartment = duty(need.dutyId)?.departmentId ?? null;
        const askable = data.departments.mine.filter((d) => data.askable.includes(d.id) && (!dutyDepartment || d.id === dutyDepartment));
        return { title: need.label, description: `${dutyName}, ${formatTimeRange(gap.start, gap.end)}: ${gap.short} short.`,
          actions: request ? (request.canChoose ? <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => run(() => stopAsking(request.id), "Stopped asking")}>Stop asking</Button> : null)
            : askable.length && date >= data.today ? <AskCoverDialog siteId={site.id} date={date} needKey={need.key} what={`${dutyName} for ${need.label}`} start={gap.start} end={gap.end} departments={askable} /> : null,
          body: <div className="flex flex-col gap-(--space-5)">
          {request ? <CoverAnswers request={request} pending={pending} onChoose={(userId, name) => run(() => chooseCover(request.id, userId), `${name} put on`)} /> : null}
          {candidates.length === 0 ? <p className="text-sm text-ui-muted-foreground">{request ? "Nobody is on shift then." : askable.length ? "Nobody is on shift then. Add a shift first, or ask staff in Google Chat." : "Nobody is on shift then. Add a shift first."}</p> : (
            <ul className="pc-list">
              {candidates.map((c) => {
                const shift = shiftOf(c.shiftId);
                const allowed = need.kind === "class" ? true : shift?.canPlan;
                return (
                  <li key={c.shiftId} className="pc-row">
                    <span className="pc-row-body">
                      <span className="pc-row-title">{nameOf(c.userId)}</span>
                      <span className="pc-row-hint">{[c.whole ? null : formatTimeRange(c.start, c.end), c.qualified ? null : "Not qualified", c.free ? "Free then" : "Busy then", c.ownDepartment ? null : "Borrowed"].filter(Boolean).join(" · ")}</span>
                    </span>
                    <Button className="min-h-11" variant={c.qualified && c.free ? "default" : "outline"} disabled={pending || !allowed}
                      onClick={() => run(() => need.kind === "class"
                        ? planClassTeacher({ source: need.source!, ref: need.classRef!, siteId: site.id, date, userId: c.userId })
                        : saveBlock({ shiftId: c.shiftId, dutyId: need.dutyId, sessionId: need.sessionId, start: c.start, end: c.end }), `${nameOf(c.userId)} put on`)}>
                      Put on
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          </div> };
      }
    }
    const shift = shiftOf(picked.shiftId);
    if (!shift) return null;
    const name = nameOf(shift.userId);
    const shiftActions = shift.canPlan ? <>
      <ShiftDialog siteId={site.id} draft={{ ...shift, id: shift.id }} people={people} departments={data.departments.mine}
        trigger={<Button variant="outline" className="min-h-11">Change shift</Button>} />
      <RemoveShiftDialog id={shift.id} name={name} date={date} trigger={<Button variant="ghost" className="min-h-11">Remove shift</Button>} />
    </> : null;
    if (picked.kind === "free") {
      return { title: `${name} is free`, description: formatTimeRange(picked.start, picked.end),
        actions: <>
          {shift.canPlan ? <BlockDialog draft={{ shiftId: shift.id, dutyId: "", sessionId: null, start: picked.start, end: picked.end, tasks: [] }} duties={dutyOptions}
            sessions={sessionOptions} who={name} onDone={close} trigger={<Button className="min-h-11">Put on a duty</Button>} /> : null}
          {shiftActions}
        </> };
    }
    const block = shift.blocks.find((b) => b.id === picked.blockId);
    if (!block) return null;
    const d = duty(block.dutyId);
    // The duty's tasks (named in Setup) are given here, block by block: whoever plans the shift ticks
    // the ones this person does and sets when each starts and ends; everyone else reads the ones given.
    const given = tasksOf(block, d?.tasks ?? []);
    const mine = block.tasks.filter((x) => d?.tasks.some((t) => t.id === x.id));
    return { title: `${name}: ${d?.name ?? "Duty"}`, description: [formatTimeRange(block.start, block.end), sessionTitle(block.sessionId)].filter(Boolean).join(" · "),
      body: shift.canPlan && d?.tasks.length
        ? <BlockTasks key={`${block.id}|${mine.map((t) => `${t.id}@${t.at}-${t.end}`).join("|")}`} idPrefix={`plan-give-${block.id}`} tasks={d.tasks} block={block} given={mine} pending={pending} onSave={(v) => giveTasks(block, v)} />
        : given.length ? <ul className="pc-list">{given.map((t) => <li key={`${t.name}${t.at}`} className="pc-row"><span className="w-28 shrink-0 tabular-nums">{formatTimeRange(t.at, t.end)}</span><span className="pc-row-body">{t.name}</span></li>)}</ul>
        : shift.canPlan && d && !d.isBreak ? <p className="text-sm text-ui-muted-foreground">{d.name} has no tasks to give. {data.manage ? "Add them to the duty in Setup." : "A manager adds them to the duty in Setup."}</p> : null,
      actions: shift.canPlan ? <>
        <BlockDialog draft={{ ...block, id: block.id }} duties={dutyOptions} sessions={sessionOptions} who={name} onDone={close} trigger={<Button className="min-h-11">Change</Button>} />
        <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => run(() => removeBlock(block.id), "Taken off")}>Take off</Button>
        {shiftActions}
      </> : shiftActions };
  })();

  const toCheck = shown.filter((s) => s.warnings.length);
  const tasks = shown.flatMap((s) => s.tasks.map((t) => ({ ...t, who: nameOf(s.userId) }))).sort((a, b) => a.at - b.at || a.end - b.end);

  return (
    <div className="flex flex-col gap-(--space-7)">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="icon" className="min-h-11 min-w-11"><Link href={link(shiftIso(date, -1))} aria-label="The day before"><ChevronLeft aria-hidden="true" /></Link></Button>
          {/* Any day in one go (owner, 4 November 2026): the date opens the device's own date picker. */}
          <div className="relative">
            <Button variant="outline" className="min-h-11 font-semibold" aria-label={`${formatDay(date)}. Choose another day`}
              onClick={() => { const input = dateInput.current; if (!input) return; try { input.showPicker(); } catch { input.focus(); } }}>
              <CalendarDays aria-hidden="true" />{formatDay(date)}
            </Button>
            <Input ref={dateInput} type="date" value={date} aria-label="Go to day" tabIndex={-1}
              className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
              onChange={(e) => { if (e.target.value && e.target.value !== date) router.push(link(e.target.value)); }} />
          </div>
          <Button asChild variant="outline" size="icon" className="min-h-11 min-w-11"><Link href={link(shiftIso(date, 1))} aria-label="The day after"><ChevronRight aria-hidden="true" /></Link></Button>
          {isToday ? null : <Button asChild variant="ghost" className="min-h-11"><Link href={link(data.today)}>Today</Link></Button>}
        </div>
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
              label={`${site.name}, area by area`} onSelect={pick} selected={pickedKey} labels="wide" />
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
                        <Button variant={r.tone ? "default" : "outline"} className="min-h-11" aria-label={`${r.tone ? "Fill" : "Open"}: ${r.title}, ${r.hint}, ${formatTimeRange(r.start, r.end)}`} onClick={() => pick(r.open)}>{r.tone ? "Fill" : "Open"}</Button>
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

      <Inspector open={inspector !== null} onOpenChange={(open) => { if (!open) close(); }} title={inspector?.title ?? ""} description={inspector?.description}
        actions={inspector?.actions ?? undefined}>{inspector?.body ?? null}</Inspector>
    </div>
  );
}
