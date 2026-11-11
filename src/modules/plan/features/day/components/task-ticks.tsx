"use client";

import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Tick, TimeField } from "@/modules/plan/shared/components/fields";
import type { BlockTask, DutyTask } from "@/modules/plan/shared/model";

/** A time kept inside a stretch. */
export const within = (at: number, span: { start: number; end: number }) => Math.min(Math.max(at, span.start), span.end);

/** The tasks a duty can come with (named in Setup), to give one person's stretch on it: tick a
 *  task, then set the time it is done at. A ticked task starts at the stretch's start. */
export function TaskTicks({ idPrefix, tasks, block, value, onChange, disabled }: {
  idPrefix: string; tasks: DutyTask[]; block: { start: number; end: number }; value: BlockTask[]; onChange: (tasks: BlockTask[]) => void; disabled?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-semibold">Tasks</legend>
      <p className="text-sm text-ui-muted-foreground">Tick the ones they do, and set the time for each.</p>
      {tasks.map((t) => {
        const given = value.find((x) => x.id === t.id);
        return (
          <div key={t.id} className="flex flex-wrap items-end justify-between gap-x-4">
            <Tick id={`${idPrefix}-${t.id}`} label={t.name} checked={Boolean(given)} disabled={disabled}
              onChange={(checked) => onChange(checked ? [...value, { id: t.id, at: block.start }] : value.filter((x) => x.id !== t.id))} />
            {given ? <div className="w-32"><TimeField id={`${idPrefix}-${t.id}-at`} label="Time" value={given.at}
              onChange={(at) => { if (at !== null) onChange(value.map((x) => x.id === t.id ? { ...x, at } : x)); }} /></div> : null}
          </div>
        );
      })}
    </fieldset>
  );
}

/** The tasks of a duty someone is already on: tick, set the times, then save them together. */
export function BlockTasks({ idPrefix, tasks, block, given, pending, onSave }: {
  idPrefix: string; tasks: DutyTask[]; block: { start: number; end: number }; given: BlockTask[]; pending: boolean; onSave: (tasks: BlockTask[]) => void;
}) {
  const [draft, setDraft] = useState(given);
  const key = (list: BlockTask[]) => [...list].sort((a, b) => a.id.localeCompare(b.id)).map((t) => `${t.id}@${t.at}`).join("|");
  const changed = key(draft) !== key(given);
  const outside = draft.some((t) => t.at < block.start || t.at > block.end);
  return (
    <div className="flex flex-col gap-3">
      <TaskTicks idPrefix={idPrefix} tasks={tasks} block={block} value={draft} onChange={setDraft} disabled={pending} />
      {changed ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button className="min-h-11" disabled={pending || outside} onClick={() => onSave(draft)}>Save tasks</Button>
          <Button variant="ghost" className="min-h-11" disabled={pending} onClick={() => setDraft(given)}>Undo</Button>
          {outside ? <p className="text-sm text-ui-muted-foreground">Keep each time inside the duty.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
