"use client";

import { formatTime } from "@/lib/format";
import { Tick } from "@/modules/plan/shared/components/fields";
import { taskTime, type DutyTask } from "@/modules/plan/shared/model";

/** The tasks a duty can come with (kept in Setup), to tick for one person's stretch on it. Each
 *  says when it would fall; one set for a time the duty isn't running at can't be given. */
export function TaskTicks({ idPrefix, tasks, block, value, onChange, disabled }: {
  idPrefix: string; tasks: DutyTask[]; block: { start: number; end: number }; value: string[]; onChange: (taskIds: string[]) => void; disabled?: boolean;
}) {
  return (
    <fieldset className="flex flex-col">
      <legend className="font-semibold">Tasks</legend>
      {tasks.map((t) => {
        const at = taskTime(block, t);
        const on = value.includes(t.id);
        const when = at !== null ? formatTime(at) : `${t.atMinutes === null ? "" : `${formatTime(t.atMinutes)}, `}not during this duty`;
        return <Tick key={t.id} id={`${idPrefix}-${t.id}`} label={`${t.name} · ${when}`} checked={on} disabled={disabled || (at === null && !on)}
          onChange={(checked) => onChange(checked ? [...value, t.id] : value.filter((x) => x !== t.id))} />;
      })}
    </fieldset>
  );
}
