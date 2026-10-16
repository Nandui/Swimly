"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field, FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { today } from "@/lib/format";
import { logHours, removeHours, removeHourTarget, saveHourTarget } from "@/modules/training/features/hours/server/actions";
import { THEME } from "@/modules/training/shared/components/dialog-kit";
import { PeopleChooser, type ChoosablePerson } from "@/modules/training/shared/components/people-chooser";

/** In-service hours (e-learning phase 5): logging hours for people, taking
 *  a wrong entry off, and what each qualification needs. */

type TypeOption = { id: string; name: string; target: { hours: number; windowMonths: number } | null };

export function LogHours({ people, types }: { people: ChoosablePerson[]; types: TypeOption[] }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const counted = types.filter((t) => t.target);
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      trigger={<Button className="min-h-11"><Plus aria-hidden="true" />Log hours</Button>}
      title="Log in-service hours"
      description="For training that happened outside a session in Turnfin, such as a pool-side drill. Sessions log their own hours when the register is closed."
      submitLabel="Log hours"
      successMessage="Hours logged"
      onOpen={() => setChosen(new Set())}
      onSuccess={() => router.refresh()}
      submit={async (formData) => {
        const result = await logHours([...chosen], {
          typeId: String(formData.get("typeId") ?? "") || null, on: String(formData.get("on") ?? ""),
          minutes: Number(formData.get("minutes") ?? 0), topic: String(formData.get("topic") ?? ""),
        });
        if (result.ok) toast.success(`Logged for ${result.logged} ${result.logged === 1 ? "person" : "people"}.`);
        return result.ok ? { ok: true } : result;
      }}
    >
      <Input id="hours-topic" name="topic" label="What it covered" required minLength={3} maxLength={200} placeholder="Spinal management drill, deep end" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="hours-on" name="on" label="Date" type="date" required max={today()} defaultValue={today()} />
        <Input id="hours-minutes" name="minutes" label="Minutes" type="number" inputMode="numeric" min={5} max={1440} step={5} required defaultValue={60} />
      </div>
      <Field label="Counts towards" htmlFor="hours-type" optional>
        <NativeSelect id="hours-type" name="typeId" defaultValue={counted[0]?.id ?? ""} className="min-h-11 w-full">
          <NativeSelectOption value="">General training hours</NativeSelectOption>
          {types.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <PeopleChooser idPrefix="hours" people={people} chosen={chosen} onChange={setChosen} legend="Who attended" />
    </FormDialog>
  );
}

export function RemoveHours({ id, name, topic }: { id: string; name: string; topic: string }) {
  const router = useRouter();
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="ghost" size="icon" className="size-11" aria-label={`Remove ${name}'s hours for ${topic}`}><Trash2 aria-hidden="true" /></Button>}
      title={`Remove ${name}'s hours?`}
      description={`${topic}. They stop counting; the entry stays in the audit log.`}
      submitLabel="Remove hours"
      destructive
      successMessage="Hours removed"
      onSuccess={() => router.refresh()}
      submit={(formData) => removeHours(id, String(formData.get("reason") ?? ""))}
    >
      <Field label="Why" htmlFor={`remove-hours-${id}`}>
        <Textarea id={`remove-hours-${id}`} name="reason" rows={2} required minLength={3} maxLength={300} />
      </Field>
    </FormDialog>
  );
}

export function HourTargetDialog({ types, current }: { types: TypeOption[]; current?: TypeOption }) {
  const router = useRouter();
  const open = types.filter((t) => !t.target);
  if (!current && !open.length) return null;
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={current
        ? <Button variant="outline" className="min-h-11" aria-label={`Change what ${current.name} needs`}><Pencil aria-hidden="true" /><span className="pc-only-wide">Change</span></Button>
        : <Button variant="outline" className="min-h-11"><Target aria-hidden="true" />Set hours for a qualification</Button>}
      title={current ? `Hours for ${current.name}` : "Set in-service hours"}
      description="How many hours of in-service training holders need, counted over a rolling window. For example a pool lifeguard qualification needs 20 hours in 12 months."
      submitLabel="Save"
      successMessage="Saved"
      onSuccess={() => router.refresh()}
      submit={(formData) => saveHourTarget(current?.id ?? String(formData.get("typeId") ?? ""), { hours: Number(formData.get("hours") ?? 0), windowMonths: Number(formData.get("windowMonths") ?? 0) })}
    >
      {current ? null : (
        <Field label="Qualification" htmlFor="target-type">
          <NativeSelect id="target-type" name="typeId" required defaultValue="" className="min-h-11 w-full">
            <NativeSelectOption value="" disabled>Choose a qualification</NativeSelectOption>
            {open.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="target-hours" name="hours" label="Hours needed" type="number" inputMode="numeric" min={1} max={500} required defaultValue={current?.target?.hours ?? 20} />
        <Input id="target-window" name="windowMonths" label="In every (months)" type="number" inputMode="numeric" min={1} max={120} required defaultValue={current?.target?.windowMonths ?? 12} />
      </div>
    </FormDialog>
  );
}

export function RemoveHourTarget({ typeId, name }: { typeId: string; name: string }) {
  return (
    <ConfirmAction
      trigger={<Button variant="ghost" size="icon" className="size-11" aria-label={`Stop counting hours for ${name}`}><Trash2 aria-hidden="true" /></Button>}
      title={`Stop counting hours for ${name}?`}
      description="Hours already logged stay on people's records."
      confirmLabel="Stop counting"
      destructive
      successMessage="Stopped"
      run={() => removeHourTarget(typeId)}
    />
  );
}
