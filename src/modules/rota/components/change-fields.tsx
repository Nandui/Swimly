"use client";

import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field } from "@/components/form-dialog";
import type { ChangeInput } from "@/modules/rota/lib/actions";
import { ROTA_CHANGE_REASON_META, ROTA_CHANGE_REASONS, type RotaChangeReason } from "@/modules/rota/lib/constants";

/** Why a day that has come changed (today or earlier): asked before any change there, and kept in
 *  the day's log with an "Update Timepoint" follow-up. Days ahead change freely. */
export function ChangeFields({ id, suggested }: { id: string; suggested?: RotaChangeReason }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Why the change" htmlFor={`${id}-reason`} hint="This day has come, so the change goes in its log.">
        <NativeSelect id={`${id}-reason`} name="reason" required defaultValue={suggested ?? ""} className="min-h-11 w-full">
          <NativeSelectOption value="" disabled>Choose a reason</NativeSelectOption>
          {ROTA_CHANGE_REASONS.map((r) => <NativeSelectOption key={r} value={r}>{ROTA_CHANGE_REASON_META[r].label}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="About the change" htmlFor={`${id}-note`} optional hint="Kept with the reason.">
        <Input id={`${id}-note`} name="changeNote" maxLength={200} className="min-h-11" />
      </Field>
    </div>
  );
}

export function changeOf(formData: FormData): ChangeInput {
  return { reason: String(formData.get("reason") ?? "") as ChangeInput["reason"], note: String(formData.get("changeNote") ?? "") };
}
