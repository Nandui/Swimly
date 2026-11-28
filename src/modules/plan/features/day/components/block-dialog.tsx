"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/form-dialog";
import { TaskTicks, within } from "@/modules/plan/features/day/components/task-ticks";
import { saveBlock } from "@/modules/plan/features/day/server/actions";
import { ChoiceField, TimeField } from "@/modules/plan/shared/components/fields";
import type { BlockTask, DutyTask } from "@/modules/plan/shared/model";

type Duty = { id: string; name: string; isBreak: boolean; defaultMinutes: number | null; tasks: DutyTask[] };
type SessionOption = { id: string; title: string; start: number; end: number; dutyIds: string[] };
export type BlockDraft = { id?: string; shiftId: string; dutyId: string; sessionId: string | null; start: number; end: number; tasks: BlockTask[] };

/** Put someone on an activity for part of their shift, with the positions they take and when; or
 *  change what they are on. Work belongs to an activity, so the one choice is what they are
 *  on: an activity that is on that day (with its kind of work, when it names more than one), or a
 *  break. A block given to a kind of work by itself before the rule still opens, and can be moved
 *  to an activity from here. */
export function BlockDialog({ trigger, draft, duties, sessions, who, onDone }: {
  trigger: React.ReactNode; draft: BlockDraft; duties: Duty[]; sessions: SessionOption[]; who: string; onDone?: () => void;
}) {
  const router = useRouter();
  const [f, setF] = useState(draft);
  const set = <K extends keyof BlockDraft>(key: K, value: BlockDraft[K]) => setF((x) => ({ ...x, [key]: value }));
  const dutyOf = (id: string) => duties.find((d) => d.id === id);
  const tasks = dutyOf(f.dutyId)?.tasks ?? [];
  /** Moving the stretch keeps each task's times inside it. */
  const setSpan = (span: { start: number; end: number }) => setF((x) => ({ ...x, ...span, tasks: span.end > span.start ? x.tasks.map((t) => ({ ...t, at: within(t.at, span), end: within(t.end, span) })) : x.tasks }));
  // What they can be on: each activity with each kind of work it needs, then the breaks.
  const alone = draft.id && !draft.sessionId && draft.dutyId && !dutyOf(draft.dutyId)?.isBreak ? draft.dutyId : null;
  const options = [
    ...sessions.flatMap((s) => s.dutyIds.filter((id) => dutyOf(id)).map((id) => ({ id: `s|${s.id}|${id}`, name: s.dutyIds.length > 1 ? `${s.title}, ${dutyOf(id)?.name}` : s.title }))),
    ...duties.filter((d) => d.isBreak).map((d) => ({ id: `b|${d.id}`, name: d.name })),
    ...(alone ? [{ id: `a|${alone}`, name: `${dutyOf(alone)?.name ?? "Work"}, not on an activity` }] : []),
  ];
  const chosen = !f.dutyId ? "" : f.sessionId ? `s|${f.sessionId}|${f.dutyId}` : dutyOf(f.dutyId)?.isBreak ? `b|${f.dutyId}` : `a|${f.dutyId}`;
  function choose(value: string) {
    const [kind, first, second] = value.split("|");
    const sessionId = kind === "s" ? first : null;
    const dutyId = kind === "s" ? second : first;
    const session = sessions.find((s) => s.id === sessionId);
    const duty = dutyOf(dutyId);
    setF((x) => {
      // A new stretch is kept inside the activity where the two meet; a new break takes its usual length.
      const inside = session ? { start: Math.max(x.start, session.start), end: Math.min(x.end, session.end) } : null;
      const span = x.id ? {} : inside && inside.end > inside.start ? inside : !session && duty?.defaultMinutes ? { end: Math.min(1440, x.start + duty.defaultMinutes) } : {};
      // Positions belong to their kind of work, so another kind starts with none chosen.
      return { ...x, ...span, dutyId, sessionId, tasks: dutyId === x.dutyId ? x.tasks : [] };
    });
  }
  return (
    <FormDialog portalClassName="turnfin-module" trigger={trigger} width="sm:max-w-lg"
      title={draft.id ? `Change what ${who} is on` : `Put ${who} on`}
      description="It has to fit inside their shift, and inside the activity's times."
      submitLabel={draft.id ? "Save" : "Put on"} successMessage={draft.id ? "Saved" : "Put on"}
      onOpen={() => setF(draft)} onSuccess={() => { router.refresh(); onDone?.(); }}
      submit={() => saveBlock({ shiftId: f.shiftId, dutyId: f.dutyId, sessionId: f.sessionId, start: f.start, end: f.end,
        tasks: f.tasks.filter((x) => tasks.some((t) => t.id === x.id)) }, draft.id)}>
      <ChoiceField id="plan-block-on" label="On" value={chosen} onChange={choose} options={options} empty="Choose an activity"
        hint={options.length ? "Filling a place on an activity closes its gap." : "Nothing is on this day yet. A manager adds activities in Setup."} />
      <div className="grid grid-cols-2 gap-4">
        <TimeField id="plan-block-start" label="From" value={f.start} onChange={(v) => setSpan({ start: v ?? 0, end: f.end })} />
        <TimeField id="plan-block-end" label="To" value={f.end} onChange={(v) => setSpan({ start: f.start, end: v ?? 0 })} />
      </div>
      {tasks.length ? <TaskTicks idPrefix="plan-block-task" tasks={tasks} block={f} value={f.tasks} onChange={(v) => set("tasks", v)} /> : null}
    </FormDialog>
  );
}
