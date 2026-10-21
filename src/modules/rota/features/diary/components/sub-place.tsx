"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Label } from "@/components/shadcn/label";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { clock } from "@/modules/rota/shared/constants";
import { ChangeFields, changeOf } from "@/modules/rota/shared/components/change-fields";
import type { Line, PersonDay } from "@/modules/rota/features/diary/model";
import { placeSub } from "@/modules/rota/features/diary/server/actions";
import { useDiary } from "@/modules/rota/features/diary/components/context";
import { firstName, lineTitle, span as spanWords } from "@/modules/rota/features/diary/components/words";

const PORTAL = "turnfin-module";

/** Quick times to tap inside a stretch: its start and each hour in it, at most eight. */
export function quickTimes(line: { start: number; end: number }) {
  const hours: number[] = [];
  for (let t = Math.ceil(line.start / 60) * 60; t < line.end; t += 60) if (t > line.start) hours.push(t);
  const all = [line.start, ...hours];
  const step = Math.ceil(all.length / 8);
  return all.filter((_, i) => i % step === 0);
}

/** The activity's sub-activities done any time, to place on someone's time on it (owner, 21
 *  October 2026: "the sub activities can be assigned at any time, during that activity, directly
 *  on the plan"). Each can be placed more than once, such as the phone at 12:30 and at 15:00. */
export function SubsToPlace({ person, line }: { person: PersonDay; line: Line }) {
  const ctx = useDiary();
  const list = (line.typeId ? ctx.subActivities[line.typeId] ?? [] : []).filter((x) => x.when === "during");
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  // Saved before the Plan placed them (no time yet): placing one gives it its time.
  const waiting = line.subs.filter((x) => x.when === "during" && x.at === null && x.id);
  const choices = [
    ...list.map((x) => ({ key: x.id, name: x.name, subActivityId: x.id, waiting: waiting.find((y) => same(y.name, x.name)) ?? null })),
    ...waiting.filter((y) => !list.some((x) => same(x.name, y.name))).map((y) => ({ key: y.id!, name: y.name, subActivityId: null, waiting: y })),
  ];
  if (!choices.length) return null;
  return (
    <div className="diary-to-place">
      <span className="diary-caption">Place on {firstName(person.name)}&apos;s time</span>
      <div className="diary-step-actions">
        {choices.map((c) => (
          <SubPlace key={c.key} person={person} line={line} subActivityId={c.subActivityId}
            sub={c.waiting ? { id: c.waiting.id!, name: c.name, at: null } : { id: null, name: c.name, at: null }} />
        ))}
      </div>
    </div>
  );
}

/** Choosing when they do one: tap a time or type one, inside their time on the activity. One
 *  already placed opens the same way, to move it or take it off. */
export function SubPlace({ person, line, sub, subActivityId = null }: {
  person: PersonDay; line: Line; sub: { id: string | null; name: string; at: number | null }; subActivityId?: string | null;
}) {
  const ctx = useDiary();
  const first = firstName(person.name);
  const [at, setAt] = useState(sub.at !== null ? clock(sub.at) : "");
  const [off, setOff] = useState(false);
  const placed = sub.at !== null;
  const id = `diary-sub-${line.key}-${sub.id ?? subActivityId ?? sub.name}`;
  return (
    <FormDialog portalClassName={PORTAL}
      title={placed ? `${sub.name}: move it or take it off` : `${sub.name}: when does ${first} do it?`}
      description={`${first} is on ${lineTitle(line)} ${spanWords(line)}. Choose a time in that.`}
      submitLabel={off ? "Take it off" : placed ? "Move it" : "Place it"} destructive={off}
      successMessage={off ? `${sub.name} taken off.` : `${sub.name} at ${at}.`}
      onOpen={() => { setAt(sub.at !== null ? clock(sub.at) : ""); setOff(false); }}
      trigger={placed
        ? <Button variant="ghost" className="diary-sub-placed" aria-label={`${sub.name} at ${at || clock(sub.at!)}: move or take off`}>{sub.name}<span className="diary-caption">Move</span></Button>
        : <Button variant="outline"><Plus aria-hidden="true" />{sub.name}</Button>}
      submit={(f) => placeSub({ siteId: ctx.siteId, date: ctx.date, departmentId: ctx.departmentFor!, id: line.assignmentId!, userId: person.userId,
        subId: sub.id, subActivityId, at: off ? "" : at }, ctx.live ? changeOf(f) : {})}>
      {off ? null : (
        <>
          <fieldset className="diary-quick-times">
            <legend className="diary-label">Tap a time</legend>
            <div className="diary-step-actions">
              {quickTimes(line).map((t) => (
                <Button key={t} type="button" variant={at === clock(t) ? "default" : "outline"} aria-pressed={at === clock(t)} className="tabular-nums" onClick={() => setAt(clock(t))}>
                  {clock(t)}
                </Button>
              ))}
            </div>
          </fieldset>
          <Input type="time" name="at" label="Or type the time" step={300} value={at} onChange={setAt} min={clock(line.start)} max={clock(line.end)} required />
        </>
      )}
      {placed ? (
        <div className="diary-sub-check">
          <Checkbox id={`${id}-off`} checked={off} onCheckedChange={(v) => setOff(v === true)} />
          <Label htmlFor={`${id}-off`} className="font-normal">Take it off {first}&apos;s day</Label>
        </div>
      ) : null}
      {ctx.live ? <ChangeFields id={id} /> : null}
    </FormDialog>
  );
}
