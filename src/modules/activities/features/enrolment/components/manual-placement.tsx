"use client";

import { UserRoundPlus, UserRoundX } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Field, FormDialog } from "@/components/form-dialog";
import { Select, type SelectGroup } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StudentPicker } from "@/modules/activities/shared/students/components/student-search";
import type { LevelOption } from "@/modules/activities/shared/curriculum/data/curriculum";
import { addManualPlacement, removeManualPlacement } from "@/modules/activities/features/enrolment/server/actions/manual-placement";

/** Reception's way onto the list when there was no assessment: a swimmer, the
 *  level they should start at, and why. */
export function AddManualPlacement({ levels }: { levels: LevelOption[] }) {
  const groups: SelectGroup[] = [];
  for (const level of levels) {
    const group = groups.find(g => g.id === level.programme.id) ?? groups[groups.push({ id: level.programme.id, title: level.programme.name, options: [] }) - 1];
    group.options.push({ value: level.id, label: level.name });
  }
  return <FormDialog
    trigger={<Button variant="default"><UserRoundPlus aria-hidden={true} className="size-4 shrink-0" />Add a swimmer</Button>}
    title="Add a swimmer to Awaiting enrolment"
    description="For a swimmer who needs a class but has not been placed by an assessment."
    submitLabel="Add to the list"
    successMessage="Swimmer added to the list"
    submit={formData => addManualPlacement({
      studentId: String(formData.get("studentId") ?? ""),
      levelId: String(formData.get("levelId") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    })}
  >
    <Field label="Swimmer" htmlFor="studentId" hint="Not on the books yet? Add them under Swimmers first, then come back here.">
      <StudentPicker id="studentId" name="studentId" />
    </Field>
    <Field label="Level" htmlFor="levelId" hint="The level they should start at. Only classes at this level are offered.">
      <Select id="levelId" name="levelId" placeholder="Pick a level" options={groups} />
    </Field>
    <Field label="Why are you adding them by hand?" htmlFor="reason" hint="It shows on the list and goes on their record.">
      <Textarea id="reason" name="reason" rows={2} maxLength={300} placeholder="Moved here from another swim school, level agreed with the swim school coordinator" />
    </Field>
  </FormDialog>;
}

export function RemoveManualPlacement({ id, name }: { id: string; name: string }) {
  return <FormDialog
    trigger={<Button variant="outline"><UserRoundX aria-hidden={true} className="size-4 shrink-0" />Take off the list<span className="sr-only"> {name}</span></Button>}
    title={`Take ${name} off the list?`}
    description="They stay on the books. You can add them again later."
    submitLabel="Take off the list"
    cancelLabel="Keep them"
    destructive
    successMessage={`${name} taken off the list`}
    submit={formData => removeManualPlacement({ id, reason: String(formData.get("reason") ?? "") })}
  >
    <Field label="Why?" htmlFor="remove-reason" hint="Optional. It goes on their record.">
      <Textarea id="remove-reason" name="reason" rows={2} maxLength={300} placeholder="Family no longer looking for lessons" />
    </Field>
  </FormDialog>;
}
