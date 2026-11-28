"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shadcn/button";
import { Inspector } from "@/components/ui-kit/inspector";
import { toast } from "@/components/ui/toast";
import { formatTimeRange } from "@/lib/format";
import { BlockDialog } from "@/modules/plan/features/day/components/block-dialog";
import { AskCoverDialog, CoverAnswers } from "@/modules/plan/features/day/components/cover";
import { SessionDayDialog } from "@/modules/plan/features/day/components/session-day";
import { planClassTeacher, removeBlock, saveBlock } from "@/modules/plan/features/day/server/actions";
import { chooseCover, stopAsking } from "@/modules/plan/features/day/server/cover-actions";
import type { PlanDayData } from "@/modules/plan/features/day/server/data";
import { BlockTasks } from "@/modules/plan/features/day/components/task-ticks";
import { lanesLabel } from "@/lib/setup/lanes";
import { openRequestFor } from "@/modules/plan/shared/cover";
import { tasksOf, type BlockTask } from "@/modules/plan/shared/model";
import { RemoveShiftDialog, ShiftDialog } from "@/modules/plan/shared/components/shift-dialog";

type Picked = { kind: "item"; key: string } | { kind: "gap"; needKey: string; index: number }
  | { kind: "block"; shiftId: string; blockId: string } | { kind: "free"; shiftId: string; start: number; end: number };

/** Whatever is picked on a Day, and the one inspector that serves it: a thing on and its places,
 *  who could fill a gap, a duty to change and its tasks to give, free time to give a duty. Both
 *  views of the Day (area by area, and one department at a time) open the same things by the same
 *  keys: `item|<key>`, `class|<key>|<userId>`, `gap|<needKey>|<index>`, `block|<shiftId>|<blockId>`
 *  and `free|<shiftId>|<start>|<end>`. */
export function useDayInspector(data: PlanDayData) {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [pending, start] = useTransition();
  const { site, date, needs, shifts, duties, people, occurrences } = data;
  const nameOf = (userId: string) => people.find((p) => p.id === userId)?.name ?? "Someone";
  const duty = (id: string) => duties.find((d) => d.id === id);
  const shiftOf = (id: string) => shifts.find((s) => s.id === id);
  const blockOwner = new Map(shifts.flatMap((s) => s.blocks.map((b) => [b.id, s] as const)));
  const sessionTitle = (id: string | null) => occurrences.find((o) => o.sessionId === id)?.title ?? null;
  const sessionOptions = occurrences.map((o) => ({ id: o.sessionId, title: o.title, start: o.start, end: o.end, dutyIds: o.needs.map((n) => n.dutyId) }));
  const dutyOptions = duties.map((d) => ({ id: d.id, name: d.name, isBreak: d.isBreak, defaultMinutes: d.defaultMinutes, tasks: d.tasks }));

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
    toast.success("Positions saved"); router.refresh();
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
              <section key={n.key} aria-label={duty(n.dutyId)?.name ?? "Work"} className="flex flex-col gap-1">
                <h3 className="font-semibold">{duty(n.dutyId)?.name ?? "Work"}{n.count > 1 ? ` × ${n.count}` : ""}</h3>
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
      const dutyName = duty(need.dutyId)?.name ?? "Work";
      const gap = need.gaps[picked.index];
      if (!gap) return null;
      // A class has one teacher for all of it; anything else can be filled in parts.
      const candidates = (data.candidates[`${need.key}#${picked.index}`] ?? []).filter((c) => need.kind !== "class" || c.whole);
      // Asking staff who are not working then: one open request for a stretch, its answers
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
            sessions={sessionOptions} who={name} onDone={close} trigger={<Button className="min-h-11">Put on</Button>} /> : null}
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
    return { title: `${name}: ${d?.name ?? "Work"}`, description: [formatTimeRange(block.start, block.end), sessionTitle(block.sessionId)].filter(Boolean).join(" · "),
      body: shift.canPlan && d?.tasks.length
        ? <BlockTasks key={`${block.id}|${mine.map((t) => `${t.id}@${t.at}-${t.end}`).join("|")}`} idPrefix={`plan-give-${block.id}`} tasks={d.tasks} block={block} given={mine} pending={pending} onSave={(v) => giveTasks(block, v)} />
        : given.length ? <ul className="pc-list">{given.map((t) => <li key={`${t.name}${t.at}`} className="pc-row"><span className="w-28 shrink-0 tabular-nums">{formatTimeRange(t.at, t.end)}</span><span className="pc-row-body">{t.name}</span></li>)}</ul>
        : shift.canPlan && d && !d.isBreak ? <p className="text-sm text-ui-muted-foreground">{d.name} has no positions to give. {data.manage ? "Add them to the kind of work in Setup." : "A manager adds them to the kind of work in Setup."}</p> : null,
      actions: shift.canPlan ? <>
        <BlockDialog draft={{ ...block, id: block.id }} duties={dutyOptions} sessions={sessionOptions} who={name} onDone={close} trigger={<Button className="min-h-11">Change</Button>} />
        <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => run(() => removeBlock(block.id), "Taken off")}>Take off</Button>
        {shiftActions}
      </> : shiftActions };
  })();

  const node = (
    <Inspector open={inspector !== null} onOpenChange={(open) => { if (!open) close(); }} title={inspector?.title ?? ""} description={inspector?.description}
      actions={inspector?.actions ?? undefined}>{inspector?.body ?? null}</Inspector>
  );
  return { pick, pickedKey, node };
}
