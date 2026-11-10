"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { DayTimeline, type DayTimelineBlock } from "@/components/ui-kit/day-timeline";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Inspector } from "@/components/ui-kit/inspector";
import { Notice } from "@/components/ui-kit/notice";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { toast } from "@/components/ui/toast";
import { formatDay, formatTime, formatTimeRange } from "@/lib/format";
import { BlockDialog } from "@/modules/plan/features/day/components/block-dialog";
import { SessionDayDialog } from "@/modules/plan/features/day/components/session-day";
import { planClassTeacher, removeBlock, saveBlock } from "@/modules/plan/features/day/server/actions";
import type { PlanDayData } from "@/modules/plan/features/day/server/data";
import { shiftIso } from "@/modules/plan/shared/model";
import { RemoveShiftDialog, ShiftDialog } from "@/modules/plan/shared/components/shift-dialog";

type Picked = { kind: "item"; key: string } | { kind: "gap"; needKey: string; index: number }
  | { kind: "block"; shiftId: string; blockId: string } | { kind: "free"; shiftId: string; start: number; end: number } | { kind: "class"; shiftId: string; ref: string };

/** The Day: what's on, area by area, with what still needs someone; each person's shift underneath;
 *  and one inspector for whichever block is picked: a thing on and its places, who could fill a gap,
 *  a duty to change, free time to give a duty. */
/** Where a name sits in a list, unknown ones last. */
const rank = (list: readonly string[], name: string) => { const at = list.indexOf(name); return at < 0 ? list.length : at; };

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
  const dutyOptions = duties.map((d) => ({ id: d.id, name: d.name, isBreak: d.isBreak, defaultMinutes: d.defaultMinutes }));

  const [from, to] = useMemo(() => {
    const spans = [...needs, ...shifts];
    if (!spans.length) return [6 * 60, 22 * 60];
    return [Math.floor(Math.min(...spans.map((s) => s.start)) / 60) * 60, Math.ceil(Math.max(...spans.map((s) => s.end)) / 60) * 60];
  }, [needs, shifts]);
  const hours = Array.from({ length: (to - from) / 60 + 1 }, (_, i) => ({ at: from + i * 60, label: formatTime(from + i * 60) }));

  // What's on (owner, 30 October 2026: "maybe the timeline should show what's on in each area"): one
  // row per area, one block per thing on there (a session with all its duties, or a class). The block
  // names it and says who is on it, or how many short in orange.
  const fillerOf = (f: { userId?: string; blockId?: string }) => f.userId ?? (f.blockId ? blockOwner.get(f.blockId)?.userId : undefined);
  const items = (() => {
    const byKey = new Map<string, { key: string; label: string; where: string; start: number; end: number; sessionId: string | null; needs: typeof needs }>();
    for (const n of needs) {
      const key = n.sessionId ? `s:${n.sessionId}` : n.key;
      const item = byKey.get(key) ?? { key, label: n.label, where: n.where, start: n.start, end: n.end, sessionId: n.sessionId, needs: [] };
      item.needs.push(n);
      byKey.set(key, item);
    }
    return [...byKey.values()].map((item) => ({ ...item,
      short: item.needs.reduce((m, n) => m + Math.max(0, ...n.gaps.map((g) => g.short)), 0),
      names: [...new Set(item.needs.flatMap((n) => n.fills.map((f) => fillerOf(f)).filter((u): u is string => Boolean(u))))],
    })).sort((a, b) => a.start - b.start || a.label.localeCompare(b.label));
  })();
  const areaOrder = data.areas.map((a) => a.name);
  const areaLanes = [...new Set(items.map((i) => i.where))]
    .sort((a, b) => Number(a === "No area") - Number(b === "No area") || rank(areaOrder, a) - rank(areaOrder, b) || a.localeCompare(b))
    .map((where) => ({ key: where, label: where }));
  const itemBlocks: DayTimelineBlock[] = items.map((i) => {
    const sub = i.short ? `${i.short} short` : i.names.length ? i.names.map(nameOf).join(", ") : "Covered";
    return { key: `item|${i.key}`, lane: i.where, start: i.start, end: i.end, kind: i.short ? "gap" as const : "ok" as const, label: i.label, sub,
      ariaLabel: `${i.label}, ${i.where}, ${formatTimeRange(i.start, i.end)}: ${sub}` };
  });
  const needsSomeone = items.filter((i) => i.short > 0);

  // People: one lane per shift, its duties, breaks, classes and free time.
  const personLanes = shown.map((s) => ({ key: s.id, label: `${nameOf(s.userId)} · ${formatTimeRange(s.start, s.end)}` }));
  const personBlocks: DayTimelineBlock[] = shown.flatMap((s) => {
    const busy = [...s.blocks.map((b) => ({ start: b.start, end: b.end })), ...s.classes.map((c) => ({ start: c.start, end: c.end }))].sort((a, b) => a.start - b.start);
    const free: { start: number; end: number }[] = [];
    let at = s.start;
    for (const b of busy) { if (b.start > at) free.push({ start: at, end: Math.min(b.start, s.end) }); at = Math.max(at, b.end); }
    if (at < s.end) free.push({ start: at, end: s.end });
    return [
      ...s.blocks.map((b) => {
        const d = duty(b.dutyId);
        const label = d?.name ?? "Duty";
        return { key: `block|${s.id}|${b.id}`, lane: s.id, start: b.start, end: b.end, kind: d?.isBreak ? "off" as const : "ok" as const, label,
          sub: sessionTitle(b.sessionId) ?? undefined, ariaLabel: `${nameOf(s.userId)}: ${label}, ${formatTimeRange(b.start, b.end)}` };
      }),
      ...s.classes.map((c) => ({ key: `class|${s.id}|${c.ref}`, lane: s.id, start: c.start, end: c.end, kind: "book" as const, label: c.title,
        sub: "Teaching", ariaLabel: `${nameOf(s.userId)}: teaching ${c.title}, ${formatTimeRange(c.start, c.end)}` })),
      ...free.filter((f) => f.end > f.start).map((f) => ({ key: `free|${s.id}|${f.start}|${f.end}`, lane: s.id, start: f.start, end: f.end, kind: "next" as const,
        label: "Free", ariaLabel: `${nameOf(s.userId)}: free ${formatTimeRange(f.start, f.end)}` })),
    ];
  });

  function pick(key: string) {
    const [kind, a, b, c] = key.split("|");
    if (kind === "item") setPicked({ kind, key: a });
    else if (kind === "block") setPicked({ kind, shiftId: a, blockId: b });
    else if (kind === "class") setPicked({ kind, shiftId: a, ref: b });
    else if (kind === "free") setPicked({ kind, shiftId: a, start: Number(b), end: Number(c) });
  }
  const close = () => setPicked(null);
  const run = (work: () => Promise<{ ok: boolean; error?: string }>, done: string) => start(async () => {
    const result = await work();
    if (!result.ok) { toast.error(result.error ?? "That didn't save."); return; }
    toast.success(done); close(); router.refresh();
  });

  const pickedKey = picked?.kind === "item" ? `item|${picked.key}` : null;
  const inspector = (() => {
    if (!picked) return null;
    if (picked.kind === "item") {
      const item = items.find((i) => i.key === picked.key);
      if (!item) return null;
      const occurrence = occurrences.find((o) => o.sessionId === item.sessionId);
      return { title: item.label, description: `${item.where} · ${formatTimeRange(item.start, item.end)}`,
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
        return { title: need.label, description: `${dutyName}, ${formatTimeRange(gap.start, gap.end)}: ${gap.short} short.`,
          body: candidates.length === 0 ? <p className="text-sm text-ui-muted-foreground">Nobody is on shift then. Add a shift first.</p> : (
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
          ) };
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
    if (picked.kind === "class") {
      const c = shift.classes.find((x) => x.ref === picked.ref);
      return { title: c?.title ?? "Class", description: c ? `${name} teaches, ${formatTimeRange(c.start, c.end)}.` : undefined,
        body: <p className="text-sm text-ui-muted-foreground">Change the teacher from the class&apos;s line in What&apos;s on.</p>, actions: shiftActions };
    }
    if (picked.kind === "free") {
      return { title: `${name} is free`, description: formatTimeRange(picked.start, picked.end),
        actions: <>
          {shift.canPlan ? <BlockDialog draft={{ shiftId: shift.id, dutyId: "", sessionId: null, start: picked.start, end: picked.end }} duties={dutyOptions}
            sessions={sessionOptions} who={name} onDone={close} trigger={<Button className="min-h-11">Put on a duty</Button>} /> : null}
          {shiftActions}
        </> };
    }
    const block = shift.blocks.find((b) => b.id === picked.blockId);
    if (!block) return null;
    const d = duty(block.dutyId);
    const tasks = shift.tasks.filter((t) => t.at >= block.start && t.at <= block.end);
    return { title: `${name}: ${d?.name ?? "Duty"}`, description: [formatTimeRange(block.start, block.end), sessionTitle(block.sessionId)].filter(Boolean).join(" · "),
      body: tasks.length ? <ul className="pc-list">{tasks.map((t) => <li key={`${t.name}${t.at}`} className="pc-row"><span className="w-12 shrink-0 tabular-nums">{formatTime(t.at)}</span><span className="pc-row-body">{t.name}</span></li>)}</ul> : null,
      actions: shift.canPlan ? <>
        <BlockDialog draft={{ ...block, id: block.id }} duties={dutyOptions} sessions={sessionOptions} who={name} onDone={close} trigger={<Button className="min-h-11">Change</Button>} />
        <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => run(() => removeBlock(block.id), "Taken off")}>Take off</Button>
        {shiftActions}
      </> : shiftActions };
  })();

  const toCheck = shown.filter((s) => s.warnings.length);
  const tasks = shown.flatMap((s) => s.tasks.map((t) => ({ ...t, who: nameOf(s.userId) }))).sort((a, b) => a.at - b.at);

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
        {canAddShift ? <ShiftDialog siteId={site.id} draft={{ userId: "", departmentId: (data.departments.mine.find((d) => d.id === department?.id) ?? data.departments.mine[0])?.id ?? "", date, start: 7 * 60, end: 15 * 60, note: "" }}
          people={people} departments={data.departments.mine} trigger={<Button variant="outline" className="min-h-11"><UserPlus aria-hidden="true" />Add a shift</Button>} /> : null}
      </div>

      {data.departments.all.length > 1 ? (
        <SegmentedLinks label="Department" items={[{ href: link(date, null), label: "All departments", current: !department },
          ...data.departments.all.map((d) => ({ href: link(date, d.id), label: d.name, current: d.id === department?.id }))]} />
      ) : null}

      {data.classDutyId ? null : <Notice tone="info" title="Classes aren't shown yet" description="Mark one duty as the one classes need, in Setup, to see swim classes and plan their teachers here." />}
      {data.clashes.map((c) => <Notice key={`${c.a}${c.b}`} tone="warning" title={c.text} />)}

      <section aria-labelledby="plan-on" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="plan-on">What&apos;s on</h2>{items.length ? <p>{needsSomeone.length ? `${needsSomeone.length} need someone` : "All covered"}</p> : null}</div>
        {items.length === 0 ? <EmptyState compact icon="calendarDays" title="Nothing on needs staff this day" hint="Add what's on, and the duties it needs, in Setup." /> : (
          <div className="pc-panel">
            <DayTimeline from={from} to={to} now={isToday ? data.now : -1} nowLabel={formatTime(data.now)} hours={hours} lanes={areaLanes} blocks={itemBlocks}
              label={`What's on at ${site.name}, area by area`} onSelect={pick} selected={pickedKey} />
          </div>
        )}
      </section>

      {needsSomeone.length ? (
        <section aria-labelledby="plan-needs" className="flex min-w-0 flex-col">
          <div className="pc-section-head"><h2 id="plan-needs">Needs someone</h2><p>{needsSomeone.length}</p></div>
          <ul className="pc-list">
            {needsSomeone.map((i) => (
              <li key={i.key} className="pc-row">
                <span className="w-28 shrink-0 tabular-nums">{formatTimeRange(i.start, i.end)}</span>
                <span className="pc-row-body"><span className="pc-row-title">{i.label}</span><span className="pc-row-hint">{i.where}</span></span>
                <span className="pc-row-trail">
                  <span className="pc-row-hint" data-tone="orange">{i.short} short</span>
                  <Button variant="outline" className="min-h-11" aria-label={`Fill ${i.label}`} onClick={() => setPicked({ kind: "item", key: i.key })}>Fill</Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="plan-people" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="plan-people">People</h2>{shown.length ? <p>{shown.length} on</p> : null}</div>
        {shown.length === 0 ? <EmptyState compact icon="users" title={department ? `Nobody is planned in ${department.name} this day` : "Nobody is planned this day"} hint={canAddShift ? "Add a shift, or plan the week first." : undefined} /> : (
          <div className="pc-panel">
            <DayTimeline from={from} to={to} now={isToday ? data.now : -1} nowLabel={formatTime(data.now)} hours={hours} lanes={personLanes} blocks={personBlocks}
              label={`People at ${site.name}`} onSelect={pick} selected={null} />
          </div>
        )}
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
          {tasks.length === 0 ? <p className="pc-section-note">No timed tasks on the duties planned.</p> : (
            <ul className="pc-list">
              {tasks.map((t, i) => <li key={`${t.who}${t.name}${t.at}${i}`} className="pc-row"><span className="w-12 shrink-0 tabular-nums">{formatTime(t.at)}</span>
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
