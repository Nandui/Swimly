"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { archiveArea, archiveDuty, cancelSession, saveArea, saveDuty, saveSession } from "@/modules/plan/features/setup/server/actions";
import { ChoiceField, TimeField } from "@/modules/plan/shared/components/fields";
import { DUTY_COLOR_LABEL, DUTY_COLORS, TASK_WHEN, TASK_WHEN_LABEL, WEEKDAYS, dutyColor, type DutyColor } from "@/modules/plan/shared/rules";

type Ref = { id: string; name: string };
const P = "turnfin-module";

/** A yes/no with its label, 44px tall. */
function Tick({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

export type DutyDraft = { id?: string; name: string; departmentId: string; qualificationTypeId: string; color: string; defaultMinutes: number | null;
  isBreak: boolean; forClasses: boolean; tasks: { name: string; when: string; atMinutes: number | null }[] };

/** Add or change a duty: what it is, whose work, who may do it, and the tasks that come with it. */
export function DutyDialog({ trigger, draft, departments, qualifications }: { trigger: React.ReactNode; draft: DutyDraft; departments: Ref[]; qualifications: Ref[] }) {
  const router = useRouter();
  const [f, setF] = useState(draft);
  const set = <K extends keyof DutyDraft>(key: K, value: DutyDraft[K]) => setF((x) => ({ ...x, [key]: value }));
  const setTask = (i: number, change: Partial<DutyDraft["tasks"][number]>) => set("tasks", f.tasks.map((t, j) => j === i ? { ...t, ...change } : t));
  return (
    <FormDialog portalClassName={P} trigger={trigger} width="sm:max-w-xl" title={draft.id ? `Change ${draft.name}` : "Add a duty"}
      description="A duty is what someone does for a stretch of their shift: Lifeguard, Swim teacher, Reception, Break."
      submitLabel={draft.id ? "Save duty" : "Add duty"} successMessage="Duty saved" onOpen={() => setF(draft)} onSuccess={() => router.refresh()}
      submit={() => saveDuty({ name: f.name, departmentId: f.departmentId || null, qualificationTypeId: f.qualificationTypeId || null, color: dutyColor(f.color),
        defaultMinutes: f.defaultMinutes, isBreak: f.isBreak, forClasses: f.forClasses,
        tasks: f.tasks.map((t) => ({ name: t.name, when: t.when as (typeof TASK_WHEN)[number], atMinutes: t.when === "at" ? t.atMinutes : null })) }, draft.id)}>
      <Field label="Name" htmlFor="plan-duty-name"><Input id="plan-duty-name" required maxLength={60} className="min-h-11" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChoiceField id="plan-duty-dept" label="Department" value={f.departmentId} onChange={(v) => set("departmentId", v)} options={departments} empty="Any department" optional />
        <ChoiceField id="plan-duty-qual" label="Needs" value={f.qualificationTypeId} onChange={(v) => set("qualificationTypeId", v)} options={qualifications} empty="No qualification" optional
          hint="The plan warns when someone doesn't hold it that day." />
        <Field label="Colour" htmlFor="plan-duty-colour">
          <NativeSelect id="plan-duty-colour" className="min-h-11 w-full" value={f.color} onChange={(e) => set("color", e.target.value as DutyColor)}>
            {DUTY_COLORS.map((c) => <NativeSelectOption key={c} value={c}>{DUTY_COLOR_LABEL[c]}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Usual length, in minutes" htmlFor="plan-duty-length" optional>
          <Input id="plan-duty-length" type="number" min={5} step={5} max={1440} className="min-h-11" value={f.defaultMinutes ?? ""}
            onChange={(e) => set("defaultMinutes", e.target.value ? Number(e.target.value) : null)} />
        </Field>
      </div>
      <Tick id="plan-duty-break" label="This is a break" checked={f.isBreak} onChange={(v) => setF((x) => ({ ...x, isBreak: v, forClasses: v ? false : x.forClasses }))} />
      {f.isBreak ? null : <Tick id="plan-duty-classes" label="Swim classes need this duty (one place each)" checked={f.forClasses} onChange={(v) => set("forClasses", v)} />}
      <fieldset className="flex flex-col gap-3">
        <legend className="font-semibold">Tasks that come with it</legend>
        {f.tasks.map((t, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 *:min-w-28 [&>*:first-child]:flex-1">
            <Field label="Task" htmlFor={`plan-task-${i}`}><Input id={`plan-task-${i}`} className="min-h-11" maxLength={80} value={t.name} onChange={(e) => setTask(i, { name: e.target.value })} /></Field>
            <Field label="When" htmlFor={`plan-task-when-${i}`}>
              <NativeSelect id={`plan-task-when-${i}`} className="min-h-11" value={t.when} onChange={(e) => setTask(i, { when: e.target.value })}>
                {TASK_WHEN.map((w) => <NativeSelectOption key={w} value={w}>{TASK_WHEN_LABEL[w]}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
            {t.when === "at" ? <TimeField id={`plan-task-at-${i}`} label="Time" value={t.atMinutes} onChange={(v) => setTask(i, { atMinutes: v })} /> : <span />}
            <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Remove ${t.name || "this task"}`}
              onClick={() => set("tasks", f.tasks.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /></Button>
          </div>
        ))}
        <div><Button type="button" variant="outline" className="min-h-11" onClick={() => set("tasks", [...f.tasks, { name: "", when: "start", atMinutes: null }])}><Plus aria-hidden="true" />Add a task</Button></div>
      </fieldset>
    </FormDialog>
  );
}

export type AreaDraft = { id?: string; name: string; parentId: string; lanes: number; departmentId: string };

/** Add or change an area: a whole area or one of its parts, with its lanes. */
export function AreaDialog({ trigger, siteId, draft, wholes, departments }: { trigger: React.ReactNode; siteId: string; draft: AreaDraft; wholes: Ref[]; departments: Ref[] }) {
  const router = useRouter();
  const [f, setF] = useState(draft);
  const set = <K extends keyof AreaDraft>(key: K, value: AreaDraft[K]) => setF((x) => ({ ...x, [key]: value }));
  return (
    <FormDialog portalClassName={P} trigger={trigger} title={draft.id ? `Change ${draft.name}` : "Add an area"}
      description="Where sessions happen: a whole area such as Pool, or a part of one such as Main pool."
      submitLabel={draft.id ? "Save area" : "Add area"} successMessage="Area saved" onOpen={() => setF(draft)} onSuccess={() => router.refresh()}
      submit={() => saveArea({ siteId, name: f.name, parentId: f.parentId || null, lanes: f.lanes, departmentId: f.departmentId || null }, draft.id)}>
      <Field label="Name" htmlFor="plan-area-name"><Input id="plan-area-name" required maxLength={60} className="min-h-11" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <ChoiceField id="plan-area-parent" label="Part of" value={f.parentId} onChange={(v) => set("parentId", v)} options={wholes.filter((w) => w.id !== draft.id)} empty="Nothing: a whole area" optional />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Lanes" htmlFor="plan-area-lanes" hint="0 for none.">
          <Input id="plan-area-lanes" type="number" min={0} max={20} className="min-h-11" value={f.lanes} onChange={(e) => set("lanes", Number(e.target.value) || 0)} />
        </Field>
        <ChoiceField id="plan-area-dept" label="Department" value={f.departmentId} onChange={(v) => set("departmentId", v)} options={departments} empty="Shared" optional />
      </div>
    </FormDialog>
  );
}

export type SessionDraft = { id?: string; title: string; areaId: string; lanes: number[]; start: number; end: number; weekdays: number[];
  firstDay: string; lastDay: string; skipDays: string[]; note: string; needs: { dutyId: string; count: number }[] };

/** Add or change what's on: where, when it repeats, the days it doesn't run, and the duties it needs.
 *  Sessions on the same area add up, so a booking lists only the staff it adds. */
export function SessionDialog({ trigger, siteId, draft, areas, duties }: {
  trigger: React.ReactNode; siteId: string; draft: SessionDraft; areas: (Ref & { lanes: number })[]; duties: Ref[];
}) {
  const router = useRouter();
  const [f, setF] = useState(draft);
  const [skip, setSkip] = useState("");
  const set = <K extends keyof SessionDraft>(key: K, value: SessionDraft[K]) => setF((x) => ({ ...x, [key]: value }));
  const area = areas.find((a) => a.id === f.areaId);
  const toggle = <T,>(list: T[], item: T) => list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  return (
    <FormDialog portalClassName={P} trigger={trigger} width="sm:max-w-2xl" title={draft.id ? `Change ${draft.title}` : "Add what's on"}
      description="Something that needs staff: the pool open, a school's lessons, a party. It repeats on the days you choose."
      submitLabel={draft.id ? "Save" : "Add"} successMessage="Saved" onOpen={() => { setF(draft); setSkip(""); }} onSuccess={() => router.refresh()}
      submit={() => saveSession({ siteId, title: f.title, areaId: f.areaId || null, lanes: f.lanes, start: f.start, end: f.end, weekdays: f.weekdays,
        firstDay: f.firstDay, lastDay: f.lastDay, skipDays: f.skipDays, note: f.note, needs: f.needs }, draft.id)}>
      <Field label="What's on" htmlFor="plan-s-title" hint="Pool open, Public swim, Lessons: Example School, Party."><Input id="plan-s-title" required maxLength={80} className="min-h-11" value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <ChoiceField id="plan-s-area" label="Area" value={f.areaId} onChange={(v) => setF((x) => ({ ...x, areaId: v, lanes: [] }))} options={areas} empty="None" optional />
        <TimeField id="plan-s-start" label="From" value={f.start} onChange={(v) => set("start", v ?? 0)} />
        <TimeField id="plan-s-end" label="To" value={f.end} onChange={(v) => set("end", v ?? 0)} />
      </div>
      {area?.lanes ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="font-semibold">Lanes</legend>
          <p className="text-sm text-ui-muted-foreground">Leave them all clear for the whole {area.name}.</p>
          <div className="flex flex-wrap gap-x-4">{Array.from({ length: area.lanes }, (_, i) => i + 1).map((l) =>
            <Tick key={l} id={`plan-s-lane-${l}`} label={`Lane ${l}`} checked={f.lanes.includes(l)} onChange={() => set("lanes", toggle(f.lanes, l))} />)}</div>
        </fieldset>
      ) : null}
      <fieldset className="flex flex-col gap-1">
        <legend className="font-semibold">Days of the week</legend>
        <div className="flex flex-wrap gap-x-4">{WEEKDAYS.map((d, i) => <Tick key={d} id={`plan-s-day-${i}`} label={d.slice(0, 3)} checked={f.weekdays.includes(i)} onChange={() => set("weekdays", toggle(f.weekdays, i))} />)}</div>
      </fieldset>
      <div className="grid grid-cols-2 gap-4">
        <Field label="First day" htmlFor="plan-s-first"><Input id="plan-s-first" type="date" required className="min-h-11" value={f.firstDay}
          onChange={(e) => setF((x) => ({ ...x, firstDay: e.target.value, lastDay: x.lastDay < e.target.value ? e.target.value : x.lastDay }))} /></Field>
        <Field label="Last day" htmlFor="plan-s-last" hint="The same day for a one-off."><Input id="plan-s-last" type="date" required min={f.firstDay} className="min-h-11" value={f.lastDay} onChange={(e) => set("lastDay", e.target.value)} /></Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-semibold">Days it doesn&apos;t run</legend>
        {f.skipDays.length ? <ul className="flex flex-wrap gap-2">{f.skipDays.map((d) => (
          <li key={d}><Button type="button" variant="outline" className="min-h-11 tabular-nums" aria-label={`Run on ${d} after all`} onClick={() => set("skipDays", f.skipDays.filter((x) => x !== d))}>{d}<Trash2 aria-hidden="true" /></Button></li>
        ))}</ul> : null}
        <div className="flex items-end gap-2">
          <Field label="Add a day" htmlFor="plan-s-skip" optional><Input id="plan-s-skip" type="date" min={f.firstDay} max={f.lastDay} className="min-h-11" value={skip} onChange={(e) => setSkip(e.target.value)} /></Field>
          <Button type="button" variant="outline" className="min-h-11" disabled={!skip} onClick={() => { set("skipDays", [...new Set([...f.skipDays, skip])].sort()); setSkip(""); }}>Add</Button>
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-semibold">Staff it needs the whole time</legend>
        <p className="text-sm text-ui-muted-foreground">Only what this adds: the pool&apos;s own lifeguards go on Pool open, not on each booking.</p>
        {f.needs.map((n, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 *:min-w-28 [&>*:first-child]:flex-1">
            <ChoiceField id={`plan-s-need-${i}`} label="Duty" value={n.dutyId} onChange={(v) => set("needs", f.needs.map((x, j) => j === i ? { ...x, dutyId: v } : x))} options={duties} empty="Choose a duty" />
            <Field label="How many" htmlFor={`plan-s-count-${i}`}><Input id={`plan-s-count-${i}`} type="number" min={1} max={20} className="min-h-11" value={n.count}
              onChange={(e) => set("needs", f.needs.map((x, j) => j === i ? { ...x, count: Number(e.target.value) || 1 } : x))} /></Field>
            <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Remove this line" onClick={() => set("needs", f.needs.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /></Button>
          </div>
        ))}
        <div><Button type="button" variant="outline" className="min-h-11" onClick={() => set("needs", [...f.needs, { dutyId: "", count: 1 }])}><Plus aria-hidden="true" />Add a duty</Button></div>
      </fieldset>
      <Field label="Note" htmlFor="plan-s-note" optional><Textarea id="plan-s-note" rows={2} maxLength={500} value={f.note} onChange={(e) => set("note", e.target.value)} /></Field>
    </FormDialog>
  );
}

/** Take a duty or area off the list, or call off what's on from today; past days keep them. */
export function RetireDialog({ kind, id, name }: { kind: "duty" | "area" | "session"; id: string; name: string }) {
  const router = useRouter();
  const words = {
    duty: { title: `Take ${name} off the duties?`, description: "Days already planned keep it. It can't be chosen again.", submit: "Take off", run: () => archiveDuty(id) },
    area: { title: `Take ${name} off the areas?`, description: "What's on there keeps its days. It can't be chosen again.", submit: "Take off", run: () => archiveArea(id) },
    session: { title: `Call off ${name} from today?`, description: "Its days so far stay as they were. Anyone planned on it from today keeps the duty, without the session.", submit: "Call off", run: () => cancelSession(id) },
  }[kind];
  return (
    <FormDialog portalClassName={P} trigger={<Button variant="ghost" className="min-h-11">{kind === "session" ? "Call off" : "Take off"}</Button>} destructive cancelLabel="Keep it"
      title={words.title} description={words.description} submitLabel={words.submit} successMessage="Done" onSuccess={() => router.refresh()} submit={words.run}>
      {null}
    </FormDialog>
  );
}
