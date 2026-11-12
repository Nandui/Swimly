"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { removeShift, saveShift } from "@/modules/plan/shared/actions";
import { ChoiceField, TimeField } from "@/modules/plan/shared/components/fields";

type Ref = { id: string; name: string };
export type ShiftDraft = { id?: string; userId: string; departmentId: string; date: string; start: number; end: number; note: string };

/** Add or change a shift: who, on which department's plan, and their times. Changing one keeps its
 *  duties; any left outside the new times are warned about on the Day. */
export function ShiftDialog({ trigger, siteId, draft, people, departments, personFixed = false }: {
  trigger: React.ReactNode; siteId: string; draft: ShiftDraft; people: Ref[]; departments: Ref[]; personFixed?: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState(draft);
  const set = <K extends keyof ShiftDraft>(key: K, value: ShiftDraft[K]) => setF((x) => ({ ...x, [key]: value }));
  const person = people.find((p) => p.id === f.userId);
  return (
    <FormDialog portalClassName="turnfin-module" trigger={trigger} width="sm:max-w-lg"
      title={draft.id ? `${person?.name ?? "Shift"}, ${draft.date}` : "Add a shift"}
      description={draft.id ? "Change the times or the plan it is on. Their duties stay." : "Put someone on at this site. Give them duties on the Day."}
      submitLabel={draft.id ? "Save shift" : "Add shift"} successMessage={draft.id ? "Shift saved" : "Shift added"}
      onOpen={() => setF(draft)} onSuccess={() => router.refresh()}
      submit={() => saveShift({ siteId, departmentId: f.departmentId, userId: f.userId, date: f.date, start: f.start, end: f.end, note: f.note }, draft.id)}>
      {personFixed || draft.id ? null : <ChoiceField id="plan-shift-who" label="Who" value={f.userId} onChange={(v) => set("userId", v)} options={people} empty="Choose someone" />}
      <ChoiceField id="plan-shift-dept" label="On the plan of" value={f.departmentId} onChange={(v) => set("departmentId", v)} options={departments} empty="Choose a department"
        hint="Someone from another department is borrowed onto this one." />
      <div className="grid grid-cols-2 gap-4">
        <TimeField id="plan-shift-start" label="Starts" value={f.start} onChange={(v) => set("start", v ?? 0)} />
        <TimeField id="plan-shift-end" label="Ends" value={f.end} onChange={(v) => set("end", v ?? 0)} />
      </div>
      <Field label="Note" htmlFor="plan-shift-note" optional>
        <Textarea id="plan-shift-note" rows={2} maxLength={300} value={f.note} onChange={(e) => set("note", e.target.value)} />
      </Field>
    </FormDialog>
  );
}

/** Remove a shift and its duties, after a confirmation. */
export function RemoveShiftDialog({ trigger, id, name, date }: { trigger: React.ReactNode; id: string; name: string; date: string }) {
  const router = useRouter();
  return (
    <FormDialog portalClassName="turnfin-module" trigger={trigger} destructive cancelLabel="Keep it"
      title={`Remove ${name}'s shift on ${date}?`} description="Their duties that day go too. The change is kept in the activity log."
      submitLabel="Remove shift" successMessage="Shift removed" onSuccess={() => router.refresh()} submit={() => removeShift(id)}>
      {null}
    </FormDialog>
  );
}
