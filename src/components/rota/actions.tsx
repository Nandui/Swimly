"use client";

import { Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field, FormDialog } from "@/components/form-dialog";
import { cancelShift, saveShift } from "@/lib/rota/actions";
import { clock } from "@/lib/rota/constants";

const THEME = "turnfin-docs turnfin-module";

type Option = { id: string; name: string };
type Shift = { id: string; date: Date; startMinutes: number; endMinutes: number; role: string; note: string; userId: string | null; requiredTypeId: string | null };

/** Add a shift (optionally on a given day) or change one. Qualification gaps
 *  are shown on the rota afterwards; they never stop the save. */
export function ShiftDialog({ siteId, date, shift, people, types, label }: { siteId: string; date: string; shift?: Shift; people: (Option & { jobTitle: string | null })[]; types: Option[]; label?: string }) {
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      trigger={shift && label
        ? <Button variant="outline" className="min-h-11"><Pencil aria-hidden="true" />{label}</Button>
        : shift
        ? <Button variant="ghost" size="icon" className="size-11" aria-label={`Change ${shift.role} ${clock(shift.startMinutes)}`}><Pencil aria-hidden="true" /></Button>
        : <Button variant="outline" className="min-h-11"><Plus aria-hidden="true" />Add shift</Button>}
      title={shift ? `Change ${shift.role}` : "Add a shift"}
      description="Leave the person empty for an open shift. A missing or expired qualification shows as a warning; it does not stop you."
      submitLabel={shift ? "Save shift" : "Add shift"}
      successMessage={shift ? "Shift saved" : "Shift added"}
      submit={(formData) => saveShift(shift?.id ?? null, {
        siteId, date: String(formData.get("date") ?? ""), start: String(formData.get("start") ?? ""), end: String(formData.get("end") ?? ""),
        role: String(formData.get("role") ?? ""), requiredTypeId: String(formData.get("requiredTypeId") ?? ""),
        userId: String(formData.get("userId") ?? ""), note: String(formData.get("note") ?? ""),
      })}
    >
      <Field label="Date" htmlFor="shift-date"><Input id="shift-date" name="date" type="date" required defaultValue={shift ? shift.date.toISOString().slice(0, 10) : date} className="min-h-11" /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Starts" htmlFor="shift-start"><Input id="shift-start" name="start" type="time" required defaultValue={shift ? clock(shift.startMinutes) : "07:00"} className="min-h-11" /></Field>
        <Field label="Ends" htmlFor="shift-end"><Input id="shift-end" name="end" type="time" required defaultValue={shift ? clock(shift.endMinutes) : "15:00"} className="min-h-11" /></Field>
      </div>
      <Field label="Shift" htmlFor="shift-role" hint="For example Lifeguard, Swim teacher, Duty manager."><Input id="shift-role" name="role" required minLength={2} maxLength={60} defaultValue={shift?.role} className="min-h-11" /></Field>
      <Field label="Needs a qualification (optional)" htmlFor="shift-type">
        <NativeSelect id="shift-type" name="requiredTypeId" defaultValue={shift?.requiredTypeId ?? ""} className="min-h-11 w-full">
          <NativeSelectOption value="">None</NativeSelectOption>
          {types.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Person" htmlFor="shift-person">
        <NativeSelect id="shift-person" name="userId" defaultValue={shift?.userId ?? ""} className="min-h-11 w-full">
          <NativeSelectOption value="">Open shift</NativeSelectOption>
          {people.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.name}{p.jobTitle ? ` · ${p.jobTitle}` : ""}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Note (optional)" htmlFor="shift-note"><Input id="shift-note" name="note" maxLength={300} defaultValue={shift?.note} className="min-h-11" /></Field>
    </FormDialog>
  );
}

export function CancelShift({ id, label, withText = false }: { id: string; label: string; withText?: boolean }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={withText
        ? <Button variant="ghost" className="min-h-11 text-[var(--pc-danger)]"><X aria-hidden="true" />Cancel shift</Button>
        : <Button variant="ghost" size="icon" className="size-11" aria-label={`Cancel ${label}`}><X aria-hidden="true" /></Button>}
      title={`Cancel ${label}?`}
      description="It disappears from the rota and from the person's Turnfin Me. The change is recorded."
      submitLabel="Cancel shift"
      successMessage="Shift cancelled"
      submit={() => cancelShift(id)}
    >
      <p className="sr-only">Confirm to cancel.</p>
    </FormDialog>
  );
}
