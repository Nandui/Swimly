"use client";

import { CalendarCheck, Trash2, UserX } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field, FormDialog } from "@/components/form-dialog";
import { endAbsence, reportAbsence, withdrawAbsence, type AbsenceInput } from "@/lib/rota/actions";
import { ABSENCE_REASON_META, ABSENCE_REASONS } from "@/lib/rota/constants";

const THEME = "turnfin-docs turnfin-module";
type Person = { id: string; name: string; jobTitle: string | null };

/** Record that someone is off. Their shifts in that time then warn "Absent"
 *  on the rota, so cover can be found; nothing is cancelled automatically. */
export function ReportAbsence({ people, today }: { people: Person[]; today: string }) {
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      trigger={<Button className="min-h-11"><UserX aria-hidden="true" />Report absence</Button>}
      title="Report an absence"
      description="Their shifts in this time show as Absent on the rota so you can find cover. Only rota managers see the reason."
      submitLabel="Report absence"
      successMessage="Absence recorded"
      submit={(formData) => reportAbsence({
        userId: String(formData.get("userId") ?? ""), reason: String(formData.get("reason") ?? "") as AbsenceInput["reason"],
        firstDay: String(formData.get("firstDay") ?? ""), lastDay: String(formData.get("lastDay") ?? ""), note: String(formData.get("note") ?? ""),
      })}
    >
      <Field label="Who is off" htmlFor="absence-person">
        <NativeSelect id="absence-person" name="userId" required defaultValue="" className="min-h-11 w-full">
          <NativeSelectOption value="" disabled>Choose a person</NativeSelectOption>
          {people.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.name}{p.jobTitle ? ` · ${p.jobTitle}` : ""}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Reason" htmlFor="absence-reason">
        <NativeSelect id="absence-reason" name="reason" required defaultValue="sickness" className="min-h-11 w-full">
          {ABSENCE_REASONS.map((r) => <NativeSelectOption key={r} value={r}>{ABSENCE_REASON_META[r].label}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="First day off" htmlFor="absence-first"><Input id="absence-first" name="firstDay" type="date" required defaultValue={today} className="min-h-11" /></Field>
        <Field label="Last day off" htmlFor="absence-last" hint="Leave empty if you don't know yet."><Input id="absence-last" name="lastDay" type="date" className="min-h-11" /></Field>
      </div>
      <Field label="Note (optional)" htmlFor="absence-note" hint="For example, when they will call again. Never medical details."><Input id="absence-note" name="note" maxLength={200} className="min-h-11" /></Field>
    </FormDialog>
  );
}

/** They are back: set their last day off. */
export function BackAtWork({ id, name, today }: { id: string; name: string; today: string }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11"><CalendarCheck aria-hidden="true" />Back at work</Button>}
      title={`${name} is back`}
      description="From the day after their last day off, their shifts no longer show as Absent."
      submitLabel="Save"
      successMessage="Marked as back"
      submit={(formData) => endAbsence(id, String(formData.get("lastDay") ?? ""))}
    >
      <Field label="Last day off" htmlFor={`absence-end-${id}`}><Input id={`absence-end-${id}`} name="lastDay" type="date" required defaultValue={today} className="min-h-11" /></Field>
    </FormDialog>
  );
}

/** Recorded in error. */
export function RemoveAbsence({ id, name }: { id: string; name: string }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="ghost" size="icon" className="size-11" aria-label={`Remove the absence for ${name}`}><Trash2 aria-hidden="true" /></Button>}
      title={`Remove the absence for ${name}?`}
      description="Only if it was recorded in error. Their shifts stop showing as Absent, and the removal is recorded."
      submitLabel="Remove absence"
      successMessage="Absence removed"
      submit={() => withdrawAbsence(id)}
    >
      <p className="sr-only">Confirm to remove.</p>
    </FormDialog>
  );
}
