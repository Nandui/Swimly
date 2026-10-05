"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { CalendarCheck, CopyPlus, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { cancelShift, copyPlan, markTimepointUpdated, saveShift, type ChangeInput } from "@/lib/rota/actions";
import { ROTA_CHANGE_REASON_META, ROTA_CHANGE_REASONS, addDaysIso, clock, mondayOf, weekStarted, type RotaChangeReason } from "@/lib/rota/constants";

const THEME = "turnfin-module";

type Option = { id: string; name: string };
type Shift = { id: string; date: Date; startMinutes: number; endMinutes: number; role: string; note: string; userId: string | null; requiredTypeId: string | null; departmentId: string | null };
/** What a new duty starts with, e.g. from a day on the pool breakdown. */
export type DutyPreset = { role?: string; start?: number; end?: number };
export type PlanOptions = { people: (Option & { jobTitle: string | null })[]; types: Option[]; departments: Option[]; duties: string[] };

/** Why a duty changed once its week has started, the optional note, and
 *  whether Timepoint is already updated (left unticked, it stays a follow-up). */
function ChangeFields({ id, suggested }: { id: string; suggested?: RotaChangeReason }) {
  const [reason, setReason] = useState<string>(suggested ?? "");
  return (
    <fieldset className="space-y-3 rounded-[var(--pc-radius-control)] border border-ui-border p-3">
      <legend className="px-1 text-sm font-medium">This week has started: why the change?</legend>
      <RadioGroup name="reason" value={reason} onValueChange={setReason} className="gap-1" required>
        {ROTA_CHANGE_REASONS.map((r) => (
          <div key={r} className="flex min-h-11 items-center gap-3">
            <RadioGroupItem id={`${id}-reason-${r}`} value={r} />
            <Label htmlFor={`${id}-reason-${r}`} className="font-normal">{ROTA_CHANGE_REASON_META[r].label}</Label>
          </div>
        ))}
      </RadioGroup>
      <Field label="Note (optional)" htmlFor={`${id}-change-note`}><Input id={`${id}-change-note`} name="changeNote" maxLength={200} className="min-h-11" /></Field>
      <div className="flex min-h-11 items-start gap-3">
        <Checkbox id={`${id}-timepoint`} name="timepoint" value="1" className="mt-1" />
        <Label htmlFor={`${id}-timepoint`} className="block font-normal">
          <span className="block font-medium">Updated in Timepoint</span>
          <span className="block text-sm text-ui-muted-foreground">Leave it unticked if you will do it later: it stays a follow-up until it is done.</span>
        </Label>
      </div>
    </fieldset>
  );
}
const changeOf = (formData: FormData): ChangeInput => ({
  reason: String(formData.get("reason") ?? "") as ChangeInput["reason"],
  changeNote: String(formData.get("changeNote") ?? ""),
  timepoint: formData.get("timepoint") === "1" || formData.get("timepoint") === "on",
});

/** Add a duty (optionally on a given day) or change one. Qualification gaps
 *  are shown on the plan afterwards; they never stop the save. Once the
 *  duty's week has started, the change asks for its reason. */
export function ShiftDialog({ siteId, date, today, shift, options, label, suggested, trigger, person, preset }: {
  siteId: string; date: string; today: string; shift?: Shift; options: PlanOptions; label?: string;
  /** The reason to offer first, e.g. cover when the person on it is off. */
  suggested?: RotaChangeReason;
  /** A trigger of the caller's own, e.g. a block on Today's timeline. Passed
   *  as parts, not an element, so a server page can hand it over. */
  trigger?: { label: string; variant?: "ghost" | "outline"; className?: string; style?: CSSProperties; children: ReactNode };
  /** The person to put on it, e.g. the cover Today suggests. */
  person?: string;
  /** A new duty's starting values. */
  preset?: DutyPreset;
}) {
  const initial = shift ? shift.date.toISOString().slice(0, 10) : date;
  const [day, setDay] = useState(initial);
  const live = weekStarted(day || initial, today) || (!!shift && weekStarted(initial, today));
  const fid = shift ? `duty-${shift.id}` : "duty-new";
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      onOpen={() => setDay(initial)}
      trigger={trigger
        ? <Button type="button" variant={trigger.variant ?? "outline"} aria-label={trigger.label} className={trigger.className} style={trigger.style}>{trigger.children}</Button>
        : (shift && label
        ? <Button variant="outline" className="min-h-11"><Pencil aria-hidden="true" />{label}</Button>
        : shift
        ? <Button variant="ghost" size="icon" className="size-11" aria-label={`Change ${shift.role} ${clock(shift.startMinutes)}`}><Pencil aria-hidden="true" /></Button>
        : <Button className="min-h-11"><Plus aria-hidden="true" />Add duty</Button>)}
      title={shift ? `Change ${shift.role}` : "Add a duty"}
      description="Leave the person empty for an unfilled duty. A missing or expired qualification shows as a warning; it does not stop you."
      submitLabel={shift ? "Save duty" : "Add duty"}
      successMessage={shift ? "Duty saved" : "Duty added"}
      submit={(formData) => saveShift(shift?.id ?? null, {
        siteId, date: String(formData.get("date") ?? ""), start: String(formData.get("start") ?? ""), end: String(formData.get("end") ?? ""),
        role: String(formData.get("role") ?? ""), departmentId: String(formData.get("departmentId") ?? ""), requiredTypeId: String(formData.get("requiredTypeId") ?? ""),
        userId: String(formData.get("userId") ?? ""), note: String(formData.get("note") ?? ""),
        count: shift ? 1 : Number(formData.get("count") ?? 1), ...changeOf(formData),
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Department" htmlFor={`${fid}-department`}>
          <NativeSelect id={`${fid}-department`} name="departmentId" defaultValue={shift?.departmentId ?? options.departments[0]?.id ?? ""} className="min-h-11 w-full">
            <NativeSelectOption value="">No department</NativeSelectOption>
            {options.departments.map((d) => <NativeSelectOption key={d.id} value={d.id}>{d.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Duty" htmlFor={`${fid}-role`} hint="For example Poolside, Gym floor, Front desk.">
          <Input id={`${fid}-role`} name="role" required minLength={2} maxLength={60} defaultValue={shift?.role ?? preset?.role} list={`${fid}-duties`} className="min-h-11" />
          <datalist id={`${fid}-duties`}>{options.duties.map((d) => <option key={d} value={d} />)}</datalist>
        </Field>
      </div>
      <Field label="Date" htmlFor={`${fid}-date`}><Input id={`${fid}-date`} name="date" type="date" required value={day} onChange={(e) => setDay(e.target.value)} className="min-h-11" /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Starts" htmlFor={`${fid}-start`}><Input id={`${fid}-start`} name="start" type="time" required defaultValue={clock(shift?.startMinutes ?? preset?.start ?? 420)} className="min-h-11" /></Field>
        <Field label="Ends" htmlFor={`${fid}-end`}><Input id={`${fid}-end`} name="end" type="time" required defaultValue={clock(shift?.endMinutes ?? preset?.end ?? 900)} className="min-h-11" /></Field>
      </div>
      {shift ? null : (
        <Field label="Places" htmlFor={`${fid}-count`} hint="More than one when several are needed, for example 2 lifeguards. Extra places start unfilled.">
          <Input id={`${fid}-count`} name="count" type="number" min={1} max={12} defaultValue={1} className="min-h-11 w-24" />
        </Field>
      )}
      <Field label="Person" htmlFor={`${fid}-person`}>
        <NativeSelect id={`${fid}-person`} name="userId" defaultValue={person ?? shift?.userId ?? ""} className="min-h-11 w-full">
          <NativeSelectOption value="">Unfilled</NativeSelectOption>
          {options.people.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.name}{p.jobTitle ? ` · ${p.jobTitle}` : ""}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Needs a qualification (optional)" htmlFor={`${fid}-type`}>
        <NativeSelect id={`${fid}-type`} name="requiredTypeId" defaultValue={shift?.requiredTypeId ?? ""} className="min-h-11 w-full">
          <NativeSelectOption value="">None</NativeSelectOption>
          {options.types.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Note (optional)" htmlFor={`${fid}-note`}><Input id={`${fid}-note`} name="note" maxLength={300} defaultValue={shift?.note} className="min-h-11" /></Field>
      {live ? <ChangeFields id={fid} suggested={suggested} /> : null}
    </FormDialog>
  );
}

export function CancelShift({ id, label, live, withText = false, suggested }: { id: string; label: string; live: boolean; withText?: boolean; suggested?: RotaChangeReason }) {
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      trigger={withText
        ? <Button variant="ghost" className="min-h-11 text-[var(--pc-danger)]"><X aria-hidden="true" />Cancel duty</Button>
        : <Button variant="ghost" size="icon" className="size-11" aria-label={`Cancel ${label}`}><X aria-hidden="true" /></Button>}
      title={`Cancel ${label}?`}
      description="It disappears from the plan and from the person's Turnfin Me."
      submitLabel="Cancel duty"
      successMessage="Duty cancelled"
      submit={(formData) => cancelShift(id, live ? changeOf(formData) : {})}
    >
      {live ? <ChangeFields id={`cancel-${id}`} suggested={suggested} /> : <p className="sr-only">Confirm to cancel.</p>}
    </FormDialog>
  );
}

/** Starts a week or a day from an earlier one: duties with the same people or
 *  unfilled, the activities and breaks inside them, the activities to cover
 *  and the day's note. Only days with nothing planned yet are filled. */
export function CopyPlan({ siteId, to, whole }: { siteId: string; to: string; whole: boolean }) {
  const [people, setPeople] = useState("same");
  const what = whole ? "week" : "day";
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      onOpen={() => setPeople("same")}
      trigger={<Button variant="outline" className="min-h-11"><CopyPlus aria-hidden="true" />Copy a {what}</Button>}
      title={`Start this ${what} from another`}
      description={`Duties, the activities and breaks inside them, the activities to cover and the notes come across${whole ? ", day by day" : ""}. Days that already have a plan are left as they are. Change what is different afterwards.`}
      submitLabel={`Copy the ${what}`}
      successMessage={`${whole ? "Week" : "Day"} copied`}
      submit={(formData) => {
        const picked = String(formData.get("from") ?? "");
        return copyPlan({ siteId, to, whole, people: people === "same", from: whole && picked ? mondayOf(picked) : picked });
      }}
    >
      <Field label={whole ? "Copy the week of" : "Copy the day"} htmlFor={`copy-from-${to}`} hint={whole ? "Any day in that week." : "For example the same day last week."}>
        <Input id={`copy-from-${to}`} name="from" type="date" required max={addDaysIso(to, -1)} defaultValue={addDaysIso(to, -7)} className="min-h-11" />
      </Field>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">People</legend>
        <RadioGroup value={people} onValueChange={setPeople} className="gap-1">
          {[["same", "The same people", "Each duty keeps who did it. Absences and clashes show as warnings."], ["none", "The shape only", "Every duty comes in unfilled, to choose who this time."]].map(([value, label, hint]) => (
            <div key={value} className="flex min-h-11 items-start gap-3 py-1">
              <RadioGroupItem id={`copy-people-${to}-${value}`} value={value} className="mt-1" />
              <Label htmlFor={`copy-people-${to}-${value}`} className="block font-normal"><span className="block font-medium">{label}</span><span className="block text-sm text-ui-muted-foreground">{hint}</span></Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>
    </FormDialog>
  );
}

/** The change is in Timepoint now. */
export function MarkTimepoint({ id, what }: { id: string; what: string }) {
  return (
    <ConfirmAction
      trigger={<Button variant="outline" className="min-h-11"><CalendarCheck aria-hidden="true" />Done in Timepoint</Button>}
      title="Updated in Timepoint?"
      description={`${what}. Confirm once Timepoint shows the change too; it closes the follow-up.`}
      confirmLabel="It is in Timepoint"
      successMessage="Recorded as updated in Timepoint"
      run={() => markTimepointUpdated(id)}
    />
  );
}
