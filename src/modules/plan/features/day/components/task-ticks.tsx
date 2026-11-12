"use client";

import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Tick, TimeField } from "@/modules/plan/shared/components/fields";
import type { BlockTask, DutyTask } from "@/modules/plan/shared/model";

/** A time kept inside a stretch. */
export const within = (at: number, span: { start: number; end: number }) => Math.min(Math.max(at, span.start), span.end);

/** Whether a task's times are inside the stretch, the end after the start. */
export const fits = (t: BlockTask, span: { start: number; end: number }) => t.at >= span.start && t.end <= span.end && t.end > t.at;

/** The tasks a duty can come with (named in Setup), to give one person's stretch on it: tick a
 *  task, then set when it starts and ends. A ticked task starts as the whole stretch. */
export function TaskTicks({ idPrefix, tasks, block, value, onChange, disabled }: {
  idPrefix: string; tasks: DutyTask[]; block: { start: number; end: number }; value: BlockTask[]; onChange: (tasks: BlockTask[]) => void; disabled?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-semibold">Tasks</legend>
      <p className="text-sm text-ui-muted-foreground">Tick the ones they do, and set when each starts and ends.</p>
      {tasks.map((t) => {
        const given = value.find((x) => x.id === t.id);
        return (
          <div key={t.id} className="flex flex-col">
            <Tick id={`${idPrefix}-${t.id}`} label={t.name} checked={Boolean(given)} disabled={disabled}
              onChange={(checked) => onChange(checked ? [...value, { id: t.id, at: block.start, end: block.end }] : value.filter((x) => x.id !== t.id))} />
            {given ? (
              <div role="group" aria-label={`When ${t.name} starts and ends`} className="grid grid-cols-2 gap-4 pb-2 pl-8">
                <TimeField id={`${idPrefix}-${t.id}-at`} label="From" value={given.at}
                  onChange={(at) => { if (at !== null) onChange(value.map((x) => x.id === t.id ? { ...x, at } : x)); }} />
                <TimeField id={`${idPrefix}-${t.id}-end`} label="To" value={given.end}
                  onChange={(end) => { if (end !== null) onChange(value.map((x) => x.id === t.id ? { ...x, end } : x)); }} />
              </div>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}

/** The tasks of a duty someone is already on: tick, set their times, then save them together. */
export function BlockTasks({ idPrefix, tasks, block, given, pending, onSave }: {
  idPrefix: string; tasks: DutyTask[]; block: { start: number; end: number }; given: BlockTask[]; pending: boolean; onSave: (tasks: BlockTask[]) => void;
}) {
  const [draft, setDraft] = useState(given);
  const key = (list: BlockTask[]) => [...list].sort((a, b) => a.id.localeCompare(b.id)).map((t) => `${t.id}@${t.at}-${t.end}`).join("|");
  const changed = key(draft) !== key(given);
  const outside = draft.some((t) => !fits(t, block));
  return (
    <div className="flex flex-col gap-3">
      <TaskTicks idPrefix={idPrefix} tasks={tasks} block={block} value={draft} onChange={setDraft} disabled={pending} />
      {changed ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button className="min-h-11" disabled={pending || outside} onClick={() => onSave(draft)}>Save tasks</Button>
          <Button variant="ghost" className="min-h-11" disabled={pending} onClick={() => setDraft(given)}>Undo</Button>
          {outside ? <p className="text-sm text-ui-muted-foreground">Keep each task inside the duty, with its end after its start.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
