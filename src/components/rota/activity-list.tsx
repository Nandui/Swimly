"use client";

import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { archiveActivityType, saveActivityType } from "@/lib/rota/actions";
import { ROTA_ACTIVITY_ICONS, ROTA_ACTIVITY_ICON_KEYS } from "@/lib/rota/meta";

const THEME = "turnfin-module";
type Option = { id: string; name: string };
export type ActivityRow = { id: string; name: string; icon: string; departmentId: string; requiredTypeId: string | null; fromClasses: boolean };

/** Add an activity to the organisation's list, or change one: its name, the department that plans
 *  it, its icon and the qualification it needs. One activity takes the swim classes. */
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
        requiredTypeId: String(formData.get("requiredTypeId") ?? ""), fromClasses: formData.get("fromClasses") === "1",
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
            {ROTA_ACTIVITY_ICON_KEYS.map((k) => <NativeSelectOption key={k} value={k}>{ROTA_ACTIVITY_ICONS[k].label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Needs a qualification" htmlFor={`${fid}-type`} optional hint="People without it show a warning; it never stops anyone being put on.">
        <NativeSelect id={`${fid}-type`} name="requiredTypeId" defaultValue={activity?.requiredTypeId ?? ""} className="min-h-11 w-full">
          <NativeSelectOption value="">None</NativeSelectOption>
          {qualifications.map((q) => <NativeSelectOption key={q.id} value={q.id}>{q.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <ChoiceRow type="checkbox" id={`${fid}-classes`} name="fromClasses" value="1" defaultChecked={activity?.fromClasses} title="Takes the swim classes"
        hint="Every class on the swim school timetable shows as this activity, and its teacher is planned on the rota." />
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
