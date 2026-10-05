"use client";

import { useState } from "react";
import { CalendarCheck, CalendarPlus, MessageSquareText, Trash2, UserX } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { Notice } from "@/components/ui-kit/notice";
import { formatDate } from "@/lib/format";
import { endAbsence, extendAbsence, recordReturnToWork, reportAbsence, withdrawAbsence, type AbsenceInput } from "@/lib/rota/actions";
import { ABSENCE_REASON_META, ABSENCE_REASONS, RETURN_FIT_META, SELF_CERTIFIED_DAYS, addDaysIso, followOn, needsFitNote, type AbsenceReason, type ReturnFit } from "@/lib/rota/constants";

const THEME = "turnfin-module";
type Earlier = { id: string; reason: AbsenceReason; firstDay: string; lastDay: string | null };
type Person = { id: string; name: string; jobTitle: string | null; absences: Earlier[] };

const day = (iso: string) => formatDate(new Date(`${iso}T00:00:00Z`));
/** "Sickness since 29 Sep, return not known" or "Sickness, 29 Sep to 2 Oct". */
function describe(a: Earlier) {
  const reason = ABSENCE_REASON_META[a.reason].label;
  if (!a.lastDay) return `${reason} since ${day(a.firstDay)}, return not known`;
  return a.lastDay === a.firstDay ? `${reason} on ${day(a.firstDay)}` : `${reason}, ${day(a.firstDay)} to ${day(a.lastDay)}`;
}

/** Two answers, each a full-height row. */
function Choice({ name, value, onChange, options }: { name: string; value: string; onChange: (v: string) => void; options: { value: string; label: string; hint: string }[] }) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="gap-1" name={name}>
      {options.map((o) => (
        <div key={o.value} className="flex min-h-11 items-start gap-3 py-1">
          <RadioGroupItem id={`${name}-${o.value}`} value={o.value} className="mt-1" />
          <Label htmlFor={`${name}-${o.value}`} className="block font-normal">
            <span className="block font-medium">{o.label}</span>
            <span className="block text-sm text-ui-muted-foreground">{o.hint}</span>
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}

/** The new last day off, or "not known yet". `earliest` is the first day the
 *  new last day may be. `canBeUnknown` is false when the return is already
 *  not known, so only a date says anything new. */
function UntilFields({ id, earliest, canBeUnknown, defaultDay }: { id: string; earliest: string; canBeUnknown: boolean; defaultDay?: string }) {
  const [unknown, setUnknown] = useState(false);
  return (
    <>
      <Field label="Off until (last day off)" htmlFor={`${id}-until`} hint={unknown ? undefined : "Their last day off, if they said."}>
        <Input id={`${id}-until`} name="lastDay" type="date" min={earliest} required={!unknown} disabled={unknown} defaultValue={defaultDay ?? earliest} className="min-h-11" />
      </Field>
      {canBeUnknown ? (
        <div className="flex min-h-11 items-center gap-3">
          <Checkbox id={`${id}-unknown`} checked={unknown} onCheckedChange={(v) => setUnknown(v === true)} />
          <Label htmlFor={`${id}-unknown`} className="font-normal">Return not known yet</Label>
          {unknown ? <input type="hidden" name="unknown" value="1" /> : null}
        </div>
      ) : null}
    </>
  );
}

const noteField = (id: string) => (
  <Field label="Note (optional)" htmlFor={id} hint="For example, when they will call again. Never medical details."><Input id={id} name="note" maxLength={200} className="min-h-11" /></Field>
);
const untilOf = (formData: FormData) => (formData.get("unknown") ? "" : String(formData.get("lastDay") ?? ""));

/** Record that someone is off. Their shifts in that time then warn "Absent"
 *  on the rota, so cover can be found; nothing is cancelled automatically.
 *  When the person is already off (or was off until yesterday), it asks
 *  whether this is the same absence running on and, if so, extends it rather
 *  than starting another. When they came back in the last four weeks, it asks
 *  whether this is the same thing again and links the two. */
export function ReportAbsence({ people, today }: { people: Person[]; today: string }) {
  const [personId, setPersonId] = useState("");
  const [firstDay, setFirstDay] = useState(today);
  const [answer, setAnswer] = useState<"same" | "separate">("same");
  const person = people.find((p) => p.id === personId);
  const follow = person ? followOn(person.absences, firstDay || today) : null;
  const extending = follow?.kind === "extend" && (follow.overlaps || answer === "same");
  const linking = follow?.kind === "again" && answer === "same";
  const reset = () => { setPersonId(""); setFirstDay(today); setAnswer("same"); };

  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      onOpen={reset}
      trigger={<Button className="min-h-11"><UserX aria-hidden="true" />Report absence</Button>}
      title="Report an absence"
      description="Their shifts in this time show as Absent on the rota so you can find cover. Only rota managers see the reason."
      submitLabel={extending ? "Extend absence" : "Report absence"}
      successMessage={extending ? "Absence extended" : "Absence recorded"}
      submit={(formData) => extending && follow
        ? extendAbsence(follow.absence.id, { lastDay: untilOf(formData), note: String(formData.get("note") ?? "") })
        : reportAbsence({
          userId: personId, reason: String(formData.get("reason") ?? "") as AbsenceInput["reason"],
          firstDay, lastDay: String(formData.get("lastDay") ?? ""), note: String(formData.get("note") ?? ""),
          continuesId: linking ? follow.absence.id : "",
        })}
    >
      <Field label="Who is off" htmlFor="absence-person">
        <NativeSelect id="absence-person" name="userId" required value={personId} onChange={(e) => { setPersonId(e.target.value); setAnswer("same"); }} className="min-h-11 w-full">
          <NativeSelectOption value="" disabled>Choose a person</NativeSelectOption>
          {people.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.name}{p.jobTitle ? ` · ${p.jobTitle}` : ""}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="First day off" htmlFor="absence-first">
        <Input id="absence-first" name="firstDay" type="date" required value={firstDay} onChange={(e) => setFirstDay(e.target.value)} className="min-h-11" />
      </Field>

      {person && follow?.kind === "extend" ? (
        <Notice title={`${person.name} is already off`} description={describe(follow.absence) + "."}>
          {follow.overlaps ? (
            <p className="mt-2 text-sm">These days are part of that absence, so this extends it. If it is something else, mark them back at work first.</p>
          ) : (
            <fieldset className="mt-3 space-y-2">
              <legend className="text-sm font-medium text-ui-foreground">Is this an extension of that absence?</legend>
              <Choice name="absence-follow" value={answer} onChange={(v) => setAnswer(v as typeof answer)} options={[
                { value: "same", label: "Yes, they are still off", hint: "The same absence runs on. It counts once." },
                { value: "separate", label: "No, it is a separate absence", hint: "For a different reason, starting fresh." },
              ]} />
            </fieldset>
          )}
        </Notice>
      ) : null}
      {person && follow?.kind === "again" ? (
        <Notice title={`${person.name} was off recently`} description={`${describe(follow.absence)}; back ${follow.daysBack === 0 ? "for under a day" : `${follow.daysBack} ${follow.daysBack === 1 ? "day" : "days"}`} before this.`}>
          <fieldset className="mt-3 space-y-2">
            <legend className="text-sm font-medium text-ui-foreground">Is it the same thing again?</legend>
            <Choice name="absence-again" value={answer} onChange={(v) => setAnswer(v as typeof answer)} options={[
              { value: "same", label: "Yes, the same again", hint: "A new absence, linked to the earlier one." },
              { value: "separate", label: "No, something different", hint: "A new absence on its own." },
            ]} />
          </fieldset>
        </Notice>
      ) : null}

      {extending && follow ? (
        <UntilFields
          key={`${follow.absence.id}-${firstDay}`}
          id="absence-extend"
          earliest={[firstDay, follow.absence.lastDay ? addDaysIso(follow.absence.lastDay, 1) : follow.absence.firstDay].sort().at(-1)!}
          canBeUnknown={!!follow.absence.lastDay}
        />
      ) : (
        <>
          <Field label="Reason" htmlFor="absence-reason">
            <NativeSelect id="absence-reason" name="reason" required key={linking ? follow.absence.reason : "reason"} defaultValue={linking ? follow.absence.reason : "sickness"} className="min-h-11 w-full">
              {ABSENCE_REASONS.map((r) => <NativeSelectOption key={r} value={r}>{ABSENCE_REASON_META[r].label}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field label="Last day off" htmlFor="absence-last" hint="Leave empty if you don't know yet."><Input id="absence-last" name="lastDay" type="date" min={firstDay} className="min-h-11" /></Field>
        </>
      )}
      {noteField("absence-note")}
    </FormDialog>
  );
}

/** Still off: run the same absence on to a later day, or to "not known". */
export function ExtendAbsence({ id, name, firstDay, lastDay, today }: { id: string; name: string; firstDay: string; lastDay: string | null; today: string }) {
  const earliest = lastDay ? addDaysIso(lastDay, 1) : [firstDay, today].sort().at(-1)!;
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11"><CalendarPlus aria-hidden="true" />Extend</Button>}
      title={`${name} is still off`}
      description={lastDay ? `Their last day off is ${day(lastDay)}. The same absence runs on; it counts once.` : "Their return is not known. Set their last day off once they say."}
      submitLabel="Extend absence"
      successMessage="Absence extended"
      submit={(formData) => extendAbsence(id, { lastDay: untilOf(formData), note: String(formData.get("note") ?? "") })}
    >
      <UntilFields id={`absence-extend-${id}`} earliest={earliest} canBeUnknown={!!lastDay} />
      {noteField(`absence-extend-note-${id}`)}
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

/** The return-to-work conversation, once they are back: when it was, whether
 *  they are fit to work or need changes to it for a while, the fit note for
 *  sickness over seven days, and a note. It closes the absence and goes on
 *  their personal file. */
export function ReturnToWork({ id, name, reason, firstDay, lastDay, today }: { id: string; name: string; reason: AbsenceReason; firstDay: string; lastDay: string; today: string }) {
  const [fit, setFit] = useState<ReturnFit>("fit");
  const [fitNote, setFitNote] = useState<"" | "yes" | "no">("");
  const asked = needsFitNote({ reason, firstDay, lastDay });
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      onOpen={() => { setFit("fit"); setFitNote(""); }}
      trigger={<Button className="min-h-11"><MessageSquareText aria-hidden="true" />Return to work</Button>}
      title={`${name}'s return to work`}
      description="A short talk on their first shift back: how they are, and anything that would help. It goes on their personal file."
      submitLabel="Save return to work"
      successMessage="Return to work recorded"
      submit={(formData) => recordReturnToWork(id, {
        metOn: String(formData.get("metOn") ?? ""), fit, adjustments: String(formData.get("adjustments") ?? ""),
        fitNote, note: String(formData.get("note") ?? ""),
      })}
    >
      <Field label="Day you talked" htmlFor={`return-on-${id}`}>
        <Input id={`return-on-${id}`} name="metOn" type="date" required min={addDaysIso(lastDay, 1)} max={today} defaultValue={today} className="min-h-11" />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ui-foreground">Are they fit to work?</legend>
        <Choice name={`return-fit-${id}`} value={fit} onChange={(v) => setFit(v as ReturnFit)} options={[
          { value: "fit", label: RETURN_FIT_META.fit.label, hint: "Back to their usual shifts and duties." },
          { value: "adjusted", label: RETURN_FIT_META.adjusted.label, hint: "For example lighter duties or shorter shifts for a while." },
        ]} />
      </fieldset>
      {fit === "adjusted" ? (
        <Field label="Changes agreed" htmlFor={`return-changes-${id}`} hint="What changes, and until when.">
          <Input id={`return-changes-${id}`} name="adjustments" required maxLength={300} className="min-h-11" />
        </Field>
      ) : null}
      {asked ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ui-foreground">Has their fit note come in?</legend>
          <p className="text-sm text-ui-muted-foreground">Sickness over {SELF_CERTIFIED_DAYS} days needs one from their doctor.</p>
          <Choice name={`return-note-${id}`} value={fitNote} onChange={(v) => setFitNote(v as typeof fitNote)} options={[
            { value: "yes", label: "Yes, we have it", hint: "Keep it with their records." },
            { value: "no", label: "Not yet", hint: "Ask them to send it in." },
          ]} />
        </fieldset>
      ) : null}
      <Field label="Note (optional)" htmlFor={`return-text-${id}`} hint="How they are and any support agreed. Never medical details.">
        <Textarea id={`return-text-${id}`} name="note" maxLength={500} rows={3} />
      </Field>
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
