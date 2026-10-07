"use client";

import { useState, type ReactNode } from "react";
import { Copy, Plus, Send } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { AreaSelect } from "@/components/setup/area-select";
import { ChoiceRow } from "@/components/ui/choice-row";
import { ChangeFields, changeOf } from "@/components/rota/change-fields";
import { assign, copyPlan, removeNeed, saveNeed, shareWeek, unassign } from "@/lib/rota/actions";
import { clock } from "@/lib/rota/constants";
import type { DayNeed } from "@/lib/rota/day";

const THEME = "turnfin-module";
type Option = { id: string; name: string };
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** Add an activity to a day ("Lifeguarding, Main pool, 07:00 to 21:30, 3 places"), or change one.
 *  Each place becomes a lane to put people on. */
export function NeedDialog({ siteId, date, live, types, places, need, trigger }: {
  siteId: string; date: string; live: boolean; types: Option[]; places: string[]; need?: DayNeed; trigger?: ReactNode;
}) {
  const fid = need ? `need-${need.id}` : `need-new-${date}`;
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      trigger={trigger ?? <Button variant="outline"><Plus aria-hidden="true" />Add activity</Button>}
      title={need ? "Change the activity" : "Add an activity"}
      description={need ? "People already on it keep their places. Take them off before removing a place they are on." : "Each place it needs becomes a row to put people on."}
      submitLabel={need ? "Save activity" : "Add activity"}
      successMessage={need ? "Activity saved" : "Activity added"}
      submit={(formData) => saveNeed(need?.id ?? null, {
        siteId, date, typeId: text(formData, "typeId"), place: text(formData, "place"), start: text(formData, "start"), end: text(formData, "end"),
        places: Number(formData.get("places") ?? 1), note: text(formData, "note"),
      }, changeOf(formData))}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Activity" htmlFor={`${fid}-type`}>
          <NativeSelect id={`${fid}-type`} name="typeId" required defaultValue={need?.typeId ?? types[0]?.id ?? ""} className="min-h-11 w-full">
            {types.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Where" htmlFor={`${fid}-place`} optional hint="The site's areas, kept in Admin.">
          <AreaSelect id={`${fid}-place`} name="place" areas={places} defaultValue={need?.place} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Starts" htmlFor={`${fid}-start`}><Input id={`${fid}-start`} name="start" type="time" step={900} required defaultValue={clock(need?.startMinutes ?? 420)} className="min-h-11" /></Field>
        <Field label="Ends" htmlFor={`${fid}-end`}><Input id={`${fid}-end`} name="end" type="time" step={900} required defaultValue={clock(need?.endMinutes ?? 1290)} className="min-h-11" /></Field>
        <Field label="People at once" htmlFor={`${fid}-places-n`}><Input id={`${fid}-places-n`} name="places" type="number" min={1} max={20} required defaultValue={need?.places ?? 1} className="min-h-11" /></Field>
      </div>
      <Field label="Note" htmlFor={`${fid}-note`} optional><Input id={`${fid}-note`} name="note" maxLength={300} defaultValue={need?.note ?? ""} className="min-h-11" /></Field>
      {live ? <ChangeFields id={fid} /> : null}
      {need ? (
        <div>
          <RemoveNeed id={need.id} live={live} />
        </div>
      ) : null}
    </FormDialog>
  );
}

function RemoveNeed({ id, live }: { id: string; live: boolean }) {
  return (
    <FormDialog portalClassName={THEME} destructive cancelLabel="Keep it"
      trigger={<Button type="button" variant="ghost" className="text-ui-destructive">Remove this activity</Button>}
      title="Remove this activity?" description="It leaves the day, with everyone on it. The people on it are told if the week is shared."
      submitLabel="Remove activity" successMessage="Activity removed"
      submit={(formData) => removeNeed(id, changeOf(formData))}>
      {live ? <ChangeFields id={`remove-${id}`} /> : <p className="text-sm text-ui-muted-foreground">Nothing else changes.</p>}
    </FormDialog>
  );
}

/** Someone on a place: change their time, or take them off (that time becomes a gap). */
export function AssignmentDialog({ live, assignment, trigger }: {
  live: boolean; trigger: ReactNode;
  assignment: { id: string; needId: string; place: number; userId: string; name: string; start: number; end: number; what: string };
}) {
  const a = assignment;
  const fid = `assign-${a.id}`;
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg" trigger={trigger}
      title={`${a.name} on ${a.what}`} description="Change their time on this place, or take them off. To put someone else on, take them off and fill the gap."
      submitLabel="Save time" successMessage="Time saved"
      submit={(formData) => assign(a.id, { needId: a.needId, place: a.place, userId: a.userId, start: text(formData, "start"), end: text(formData, "end") }, changeOf(formData))}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="From" htmlFor={`${fid}-start`}><Input id={`${fid}-start`} name="start" type="time" step={900} required defaultValue={clock(a.start)} className="min-h-11" /></Field>
        <Field label="To" htmlFor={`${fid}-end`}><Input id={`${fid}-end`} name="end" type="time" step={900} required defaultValue={clock(a.end)} className="min-h-11" /></Field>
      </div>
      {live ? <ChangeFields id={fid} /> : null}
      <div>
        <FormDialog portalClassName={THEME} destructive cancelLabel="Keep them on"
          trigger={<Button type="button" variant="ghost" className="text-ui-destructive">Take {a.name.split(" ")[0]} off</Button>}
          title={`Take ${a.name} off?`} description={`${clock(a.start)} to ${clock(a.end)} on ${a.what} becomes a gap to fill.`}
          submitLabel="Take off" successMessage="Taken off"
          submit={(formData) => unassign(a.id, changeOf(formData))}>
          {live ? <ChangeFields id={`${fid}-off`} suggested="cover" /> : <p className="text-sm text-ui-muted-foreground">They are told if the week is shared.</p>}
        </FormDialog>
      </div>
    </FormDialog>
  );
}

/** Copy a day or the whole week onto days with nothing of this department on them yet. */
export function CopyDialog({ siteId, departmentId, date, monday, options }: {
  siteId: string; departmentId: string; date: string; monday: string;
  /** The earlier days and weeks to copy from, newest first. */
  options: { days: { iso: string; label: string }[]; weeks: { iso: string; label: string }[] };
}) {
  const [days, setDays] = useState<"1" | "7">("1");
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={<Button variant="outline"><Copy aria-hidden="true" />Copy</Button>}
      title="Copy onto this plan" description="Copying only fills days with nothing of this department on them, so nothing you planned is overwritten."
      submitLabel="Copy" successMessage="Copied"
      submit={(formData) => copyPlan({ siteId, departmentId, from: text(formData, "from"), to: days === "7" ? monday : date, days: days === "7" ? 7 : 1, people: formData.get("people") === "1" })}>
      <RadioGroup name="days" value={days} onValueChange={(v) => setDays(v as "1" | "7")} className="gap-2" aria-label="What to copy">
        <ChoiceRow type="radio" id="copy-day" value="1" title="One day onto this day" />
        <ChoiceRow type="radio" id="copy-week" value="7" title="A whole week onto this week" />
      </RadioGroup>
      <Field label="Copy from" htmlFor="copy-from">
        <NativeSelect key={days} id="copy-from" name="from" required className="min-h-11 w-full" defaultValue={(days === "7" ? options.weeks : options.days)[0]?.iso}>
          {(days === "7" ? options.weeks : options.days).map((o) => <NativeSelectOption key={o.iso} value={o.iso}>{o.label}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <ChoiceRow type="checkbox" id="copy-people" name="people" value="1" defaultChecked title="Keep the same people" hint="Untick to copy only the activities and fill them again." />
    </FormDialog>
  );
}

/** Share the department's week with its staff: they see it in Turnfin Me and are told once. */
export function ShareWeek({ siteId, departmentId, monday, department, gaps }: { siteId: string; departmentId: string; monday: string; department: string; gaps: number }) {
  return (
    <ConfirmAction
      trigger={<Button><Send aria-hidden="true" />Share week</Button>}
      title={`Share ${department}'s week?`}
      description={gaps ? `${gaps} ${gaps === 1 ? "gap is" : "gaps are"} still to fill. Staff see their own days in Turnfin Me now, and hear about any change to them after this.`
        : "Staff see their own days in Turnfin Me now, and hear about any change to them after this."}
      confirmLabel="Share week" successMessage="Week shared"
      run={() => shareWeek({ siteId, departmentId, monday })} />
  );
}
