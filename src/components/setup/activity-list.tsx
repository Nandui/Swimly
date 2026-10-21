"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Label } from "@/components/shadcn/label";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { archiveActivityType, saveActivityType, saveSubActivities } from "@/lib/setup/actions";
import { ACTIVITY_ICONS, ACTIVITY_ICON_KEYS, SUB_WHEN, SUB_WHENS, subTimes, type SubWhen } from "@/lib/setup/meta";

const THEME = "turnfin-module";
type Option = { id: string; name: string };
export type ActivityRow = { id: string; name: string; icon: string; departmentId: string; requiredTypeId: string | null; fromClasses: boolean };

/** Add an activity to the organisation's list, or change one: its name, the department that plans
 *  it, its icon and the qualification it needs. Swim classes need none: they fill the Plan by themselves. */
export function ActivityDialog({ activity, departments, qualifications }: { activity?: ActivityRow; departments: Option[]; qualifications: Option[] }) {
  const fid = activity ? `activity-${activity.id}` : "activity-new";
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={activity ? <Button variant="outline" size="icon" aria-label={`Change ${activity.name}`}><Pencil aria-hidden="true" /></Button> : <Button><Plus aria-hidden="true" />Add activity</Button>}
      title={activity ? `Change ${activity.name}` : "Add an activity"}
      description="Every day planned with it uses these words, icon and qualification."
      submitLabel={activity ? "Save activity" : "Add activity"} successMessage={activity ? "Activity saved" : "Activity added"}
      submit={(formData) => saveActivityType(activity?.id ?? null, {
        name: String(formData.get("name") ?? ""), departmentId: String(formData.get("departmentId") ?? ""), icon: String(formData.get("icon") ?? "activity"),
        requiredTypeId: String(formData.get("requiredTypeId") ?? ""),
      })}>
      <Field label="Name" htmlFor={`${fid}-name`} hint="For example Lifeguarding, Teaching, Reception."><Input id={`${fid}-name`} name="name" required minLength={2} maxLength={40} defaultValue={activity?.name} className="min-h-11" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Department" htmlFor={`${fid}-department`} hint="The department that plans it.">
          <NativeSelect id={`${fid}-department`} name="departmentId" required defaultValue={activity?.departmentId ?? departments[0]?.id ?? ""} className="min-h-11 w-full">
            {departments.map((d) => <NativeSelectOption key={d.id} value={d.id}>{d.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Icon" htmlFor={`${fid}-icon`}>
          <NativeSelect id={`${fid}-icon`} name="icon" defaultValue={activity?.icon ?? "activity"} className="min-h-11 w-full">
            {ACTIVITY_ICON_KEYS.map((k) => <NativeSelectOption key={k} value={k}>{ACTIVITY_ICONS[k].label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Needs a qualification" htmlFor={`${fid}-type`} optional hint="People without it show a warning; it never stops anyone being put on.">
        <NativeSelect id={`${fid}-type`} name="requiredTypeId" defaultValue={activity?.requiredTypeId ?? ""} className="min-h-11 w-full">
          <NativeSelectOption value="">None</NativeSelectOption>
          {qualifications.map((q) => <NativeSelectOption key={q.id} value={q.id}>{q.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
    </FormDialog>
  );
}

export function ArchiveActivity({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  return (
    <ConfirmAction
      trigger={<Button variant="outline" size="icon" aria-label={archived ? `Restore ${name}` : `Archive ${name}`}>{archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}</Button>}
      title={archived ? `Restore ${name}?` : `Archive ${name}?`}
      description={archived ? "It can be planned again." : "It can no longer be added to a day. Days already planned with it keep it."}
      confirmLabel={archived ? "Restore" : "Archive"} successMessage={archived ? "Activity restored" : "Activity archived"}
      run={() => archiveActivityType(id, !archived)} />
  );
}

export type SubRow = { id: string; name: string; when: string; atMinutes: number | null; times: number[]; usual: boolean };
type Draft = { key: string; id: string; name: string; when: SubWhen; times: string[]; usual: boolean };
const hhmm = (m: number | null) => (m === null ? "" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);

/** An activity's sub-activities (owner, 20 October 2026): what is done while on it, such as Till
 *  1's "Open the cash till" at the start and "Close the cash till" at the end, and whether it is
 *  usual (given to whoever is put on it) or only when the plan chooses it. */
export function SubActivitiesDialog({ activity, subs }: { activity: { id: string; name: string }; subs: SubRow[] }) {
  const start = (): Draft[] => subs.map((x) => ({ key: x.id, id: x.id, name: x.name, when: (SUB_WHENS as string[]).includes(x.when) ? x.when as SubWhen : "during", times: subTimes(x).map(hhmm), usual: x.usual }));
  const [rows, setRows] = useState<Draft[]>(start);
  const [next, setNext] = useState(0);
  const set = (key: string, patch: Partial<Draft>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const fid = `subs-${activity.id}`;
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-2xl" onOpen={() => setRows(start())}
      trigger={<Button variant="outline"><ListChecks aria-hidden="true" />Sub-activities{subs.length ? ` (${subs.length})` : ""}</Button>}
      title={`${activity.name}: sub-activities`}
      description="What is done while on it, and when. Usual ones are given to whoever is put on it; the Plan can add or take off any of them for a day."
      submitLabel="Save sub-activities" successMessage="Sub-activities saved"
      submit={() => saveSubActivities(activity.id, rows.map((r) => ({ id: r.id, name: r.name, when: r.when, times: r.when === "at" ? r.times : [], usual: r.usual })))}>
      {rows.length ? (
        <ul className="flex flex-col gap-4">
          {rows.map((r, i) => (
            <li key={r.key} className="grid items-end gap-3 sm:grid-cols-12">
              <div className="sm:col-span-7">
                <Field label={`Sub-activity ${i + 1}`} htmlFor={`${fid}-${r.key}-name`}>
                  <Input id={`${fid}-${r.key}-name`} value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} required minLength={2} maxLength={60} className="min-h-11" />
                </Field>
              </div>
              <div className="sm:col-span-5">
                <Field label="When" htmlFor={`${fid}-${r.key}-when`}>
                  <NativeSelect id={`${fid}-${r.key}-when`} value={r.when}
                    onChange={(e) => set(r.key, { when: e.target.value as SubWhen, times: e.target.value === "at" && !r.times.length ? [""] : r.times })} className="min-h-11 w-full">
                    {SUB_WHENS.map((w) => <NativeSelectOption key={w} value={w}>{SUB_WHEN[w]}</NativeSelectOption>)}
                  </NativeSelect>
                </Field>
              </div>
              {r.when === "at" ? <SubTimes id={`${fid}-${r.key}`} name={r.name || `sub-activity ${i + 1}`} times={r.times} onChange={(times) => set(r.key, { times })} /> : null}
              <div className="flex min-h-11 items-center gap-2 sm:col-span-9">
                <Checkbox id={`${fid}-${r.key}-usual`} checked={r.usual} onCheckedChange={(v) => set(r.key, { usual: v === true })} />
                <Label htmlFor={`${fid}-${r.key}-usual`} className="font-normal">Usual: give it to whoever is put on {activity.name}</Label>
              </div>
              <div className="flex justify-end sm:col-span-3">
                <Button type="button" variant="ghost" onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}><Trash2 aria-hidden="true" />Remove</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-ui-muted-foreground">None yet. For example, Open the cash till at the start and Close the cash till at the end.</p>}
      <Button type="button" variant="outline" onClick={() => { setRows((list) => [...list, { key: `new-${next}`, id: "", name: "", when: "during", times: [], usual: true }]); setNext((n) => n + 1); }}>
        <Plus aria-hidden="true" />Add a sub-activity
      </Button>
    </FormDialog>
  );
}

/** A sub-activity's set times (owner, 21 October 2026: "custom times as needed", such as cash drops
 *  at 12:00 and 16:00): as many as it needs, at least one. */
function SubTimes({ id, name, times, onChange }: { id: string; name: string; times: string[]; onChange: (times: string[]) => void }) {
  const list = times.length ? times : [""];
  return (
    <fieldset className="flex flex-col gap-2 sm:col-span-12">
      <legend className="text-sm font-medium">Times</legend>
      <ul className="flex flex-wrap gap-3">
        {list.map((t, i) => (
          <li key={i} className="flex items-center gap-1">
            <Input id={`${id}-at-${i}`} aria-label={`${name} time ${i + 1}`} type="time" step={300} value={t} required className="min-h-11"
              onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} />
            {list.length > 1 ? (
              <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Remove ${name} time ${i + 1}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>
                <X aria-hidden="true" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {list.length < 12 ? (
        <Button type="button" variant="outline" className="self-start" onClick={() => onChange([...list, ""])}><Plus aria-hidden="true" />Add a time</Button>
      ) : null}
    </fieldset>
  );
}
