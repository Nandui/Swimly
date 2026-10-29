"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { markOff, withdrawOff } from "@/modules/plan/features/off/server/actions";
import { ChoiceField } from "@/modules/plan/shared/components/fields";
import { OFF_REASON_META, OFF_REASONS, type OffInput } from "@/modules/plan/shared/rules";

/** Mark someone off for one day or several, so nobody plans them. */
export function MarkOffDialog({ siteId, people, today }: { siteId: string; people: { id: string; name: string }[]; today: string }) {
  const router = useRouter();
  const blank = (): Required<OffInput> => ({ userId: "", firstDay: today, lastDay: today, reason: "holiday", note: "" });
  const [f, setF] = useState(blank);
  const set = <K extends keyof OffInput>(key: K, value: Required<OffInput>[K]) => setF((x) => ({ ...x, [key]: value }));
  return (
    <FormDialog portalClassName="turnfin-module" trigger={<Button className="min-h-11"><CalendarOff aria-hidden="true" />Mark someone off</Button>}
      title="Mark someone off" description="They show as off on the Week and Day, and can't be planned without a warning."
      submitLabel="Mark off" successMessage="Marked off" onOpen={() => setF(blank())} onSuccess={() => router.refresh()} submit={() => markOff(siteId, f)}>
      <ChoiceField id="plan-off-who" label="Who" value={f.userId} onChange={(v) => set("userId", v)} options={people} empty="Choose someone" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="First day" htmlFor="plan-off-from"><Input id="plan-off-from" type="date" required className="min-h-11" value={f.firstDay}
          onChange={(e) => setF((x) => ({ ...x, firstDay: e.target.value, lastDay: x.lastDay < e.target.value ? e.target.value : x.lastDay }))} /></Field>
        <Field label="Last day" htmlFor="plan-off-to"><Input id="plan-off-to" type="date" required className="min-h-11" min={f.firstDay} value={f.lastDay} onChange={(e) => set("lastDay", e.target.value)} /></Field>
      </div>
      <Field label="Why" htmlFor="plan-off-why">
        <NativeSelect id="plan-off-why" className="min-h-11 w-full" value={f.reason} onChange={(e) => set("reason", e.target.value as OffInput["reason"])}>
          {OFF_REASONS.map((r) => <NativeSelectOption key={r} value={r}>{OFF_REASON_META[r].label}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Note" htmlFor="plan-off-note" optional hint="Nothing medical: sickness records stay in the old Rota and HR.">
        <Textarea id="plan-off-note" rows={2} maxLength={300} value={f.note} onChange={(e) => set("note", e.target.value)} />
      </Field>
    </FormDialog>
  );
}

/** Take back a day off recorded in error. */
export function WithdrawOffDialog({ siteId, id, name }: { siteId: string; id: string; name: string }) {
  const router = useRouter();
  return (
    <FormDialog portalClassName="turnfin-module" trigger={<Button variant="outline" className="min-h-11">Take back</Button>} destructive cancelLabel="Keep it"
      title={`Take back ${name}'s time off?`} description="Use this when it was recorded in error. The change is kept in the activity log."
      submitLabel="Take back" successMessage="Taken back" onSuccess={() => router.refresh()} submit={() => withdrawOff(siteId, id)}>
      {null}
    </FormDialog>
  );
}
