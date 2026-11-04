"use client";

import { useState } from "react";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { coverShift, logAttendance } from "@/modules/staffing/features/today/server/actions";
import { checked, PersonPicker, text, THEME, useRefresh } from "@/modules/staffing/shared/components/kit";
import { CALL_METHOD_LABEL, CALL_METHODS, type AttendanceKind, type CallMethod, type Candidate, type FitShift, type StaffingSettings } from "@/modules/staffing/shared/rules";

/** Log what happened with a shift (BR-6): a call-off with the time it came in, a late arrival, or
 *  no call and no show. On-time and any strike are worked out on saving. */
export function LogAttendance({ shiftId, person, shiftName, day, nowTime, settings }: { shiftId: string; person: string; shiftName: string; day: string; nowTime: string; settings: StaffingSettings }) {
  const refresh = useRefresh();
  const [kind, setKind] = useState<AttendanceKind>("call_off");
  const fid = `stf-log-${shiftId}`;
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg" trigger={<Button variant="outline">Log</Button>}
      title={`Log for ${person}`} description={shiftName} submitLabel="Save" successMessage="Logged" onSuccess={refresh}
      submit={(fd) => logAttendance(shiftId, kind === "call_off"
        ? { kind, calledOn: text(fd, "calledOn"), calledAt: text(fd, "calledAt"), method: text(fd, "method") as CallMethod, reason: text(fd, "reason") as "sick" | "other", exceptional: checked(fd, "exceptional"), note: text(fd, "note") }
        : kind === "late" ? { kind, minutesLate: text(fd, "minutesLate"), sentHome: checked(fd, "sentHome"), note: text(fd, "note") } : { kind, note: text(fd, "note") })}>
      <SegmentedChoice aria-label="What happened" value={kind} onValueChange={(v) => setKind(v as AttendanceKind)} fill="phone"
        options={[{ value: "call_off", label: "Called off" }, { value: "late", label: "Late" }, { value: "no_show", label: "No show" }]} />
      {kind === "call_off" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Day they called" htmlFor={`${fid}-on`}><Input id={`${fid}-on`} name="calledOn" type="date" required defaultValue={day} className="min-h-11" /></Field>
            <Field label="Time they called" htmlFor={`${fid}-at`}><Input id={`${fid}-at`} name="calledAt" type="time" required defaultValue={nowTime} className="min-h-11" /></Field>
          </div>
          <Field label="How" htmlFor={`${fid}-method`} hint="Only a phone call to the centre landline counts as calling off.">
            <NativeSelect id={`${fid}-method`} name="method" defaultValue="phone" className="min-h-11 w-full">
              {CALL_METHODS.map((m) => <NativeSelectOption key={m} value={m}>{CALL_METHOD_LABEL[m]}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field label="Reason" htmlFor={`${fid}-reason`} hint="Never write medical details.">
            <NativeSelect id={`${fid}-reason`} name="reason" defaultValue="sick" className="min-h-11 w-full">
              <NativeSelectOption value="sick">Sick</NativeSelectOption>
              <NativeSelectOption value="other">Something else (not sickness)</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Label className="flex min-h-11 items-center gap-3"><Checkbox name="exceptional" />Exceptional circumstances (on time if at least {settings.callMinimumHours} hour{settings.callMinimumHours === 1 ? "" : "s"} before)</Label>
        </>
      ) : kind === "late" ? (
        <>
          <Field label="Minutes late" htmlFor={`${fid}-late`} hint={`Over ${settings.lateArrivalMinutes} minutes without calling is a strike.`}>
            <Input id={`${fid}-late`} name="minutesLate" type="number" inputMode="numeric" min={1} max={600} required className="min-h-11" />
          </Field>
          <Label className="flex min-h-11 items-center gap-3"><Checkbox name="sentHome" />Sent home unpaid</Label>
        </>
      ) : <p className="text-sm">A no call, no show goes straight to the centre manager and HR as a possible serious misconduct referral.</p>}
      <Field label="Note" htmlFor={`${fid}-note`} optional><Textarea id={`${fid}-note`} name="note" maxLength={500} /></Field>
    </FormDialog>
  );
}

/** Put someone on in an away person's place or an empty one, best fit first (BR-10.1). */
export function CoverPlace({ shift, people, shifts, settings, exclude }: { shift: FitShift & { id: string; name: string }; people: readonly Candidate[]; shifts: readonly (FitShift & { userId: string })[]; settings: StaffingSettings; exclude: string[] }) {
  return (
    <PersonPicker shift={shift} people={people} shifts={shifts} settings={settings} exclude={exclude}
      trigger={<Button>Cover</Button>} title="Who covers?" submitLabel="Put them on" successMessage="Cover saved"
      description="Move the float first, then the cover list, then the other centres. Never cancel a school booking or go over a ratio."
      act={(userId) => (userId ? coverShift(shift.id, userId) : Promise.resolve({ ok: false as const, error: "Choose who covers." }))} />
  );
}
