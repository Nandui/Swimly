"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field, FormDialog } from "@/components/form-dialog";
import { AreaSelect } from "@/components/setup/area-select";
import { Notice } from "@/components/ui-kit/notice";
import { cancelRepeat, saveRepeat, type RepeatInput } from "@/modules/rota/lib/actions";
import { formatDate } from "@/lib/format";
import { BOOKING_KIND_META, BOOKING_KINDS, WEEKDAY_LABELS, addDaysIso, bookingDates, nextWeekday } from "@/modules/rota/lib/constants";

const THEME = "turnfin-module";
type Option = { id: string; name: string };
const WEEKDAYS = [0, 1, 2, 3, 4];
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** A booking that repeats (owner decision, 6 October 2026): school lessons, a party, lane hire.
 *  It is one activity on each of its days, from tomorrow on; each day is then planned and changed
 *  on its own on the Plan. */
export function BookingDialog({ siteId, today, types, places }: { siteId: string; today: string; types: Option[]; places: string[] }) {
  const start = nextWeekday(addDaysIso(today, 1), WEEKDAYS);
  const [days, setDays] = useState<number[]>(WEEKDAYS);
  const [firstDay, setFirstDay] = useState(start);
  const [lastDay, setLastDay] = useState(start);
  const [skip, setSkip] = useState<string[]>([]);
  const [skipDraft, setSkipDraft] = useState("");
  const reset = () => { setDays(WEEKDAYS); setFirstDay(start); setLastDay(start); setSkip([]); setSkipDraft(""); };
  const inRange = skip.filter((d) => d >= firstDay && d <= lastDay);
  const sessions = firstDay && lastDay && lastDay >= firstDay ? bookingDates(firstDay, lastDay, days, inRange).length : 0;
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-2xl" onOpen={reset}
      trigger={<Button><Plus aria-hidden="true" />New booking</Button>}
      title="New booking" description="It adds its activity on each of its days, ready to plan who on the Plan."
      submitLabel="Save booking" successMessage="Booking saved"
      submit={(formData) => saveRepeat({
        siteId, kind: text(formData, "kind") as RepeatInput["kind"], title: text(formData, "title"), typeId: text(formData, "typeId"), place: text(formData, "place"),
        start: text(formData, "start"), end: text(formData, "end"), places: Number(formData.get("places") ?? 1), weekdays: days, firstDay, lastDay, skipDates: inRange,
      })}>
      <div className="grid items-end gap-4 sm:grid-cols-2">
        <Field label="What it is" htmlFor="booking-kind">
          <NativeSelect id="booking-kind" name="kind" defaultValue="school" className="min-h-11 w-full">
            {BOOKING_KINDS.map((k) => <NativeSelectOption key={k} value={k}>{BOOKING_KIND_META[k].label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Who it is for" htmlFor="booking-title" hint="For example the school's name."><Input id="booking-title" name="title" required minLength={2} maxLength={80} className="min-h-11" /></Field>
        <Field label="Activity it needs" htmlFor="booking-type">
          <NativeSelect id="booking-type" name="typeId" required defaultValue={types[0]?.id ?? ""} className="min-h-11 w-full">
            {types.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Where" htmlFor="booking-place" optional hint="The site's areas, kept in Admin.">
          <AreaSelect id="booking-place" name="place" areas={places} />
        </Field>
      </div>
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 font-semibold">Which days</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={label} className="flex min-h-11 items-center gap-2">
              <Checkbox id={`booking-day-${i}`} checked={days.includes(i)} onCheckedChange={(v) => setDays((d) => (v === true ? [...d, i].sort() : d.filter((x) => x !== i)))} />
              <Label htmlFor={`booking-day-${i}`} className="font-normal">{label.slice(0, 3)}</Label>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Field label="Starts" htmlFor="booking-start"><Input id="booking-start" name="start" type="time" required step={900} defaultValue="09:30" className="min-h-11" /></Field>
        <Field label="Ends" htmlFor="booking-end"><Input id="booking-end" name="end" type="time" required step={900} defaultValue="11:30" className="min-h-11" /></Field>
        <Field label="People" htmlFor="booking-places-n"><Input id="booking-places-n" name="places" type="number" required min={1} max={20} defaultValue={1} className="min-h-11" /></Field>
        <Field label="First day" htmlFor="booking-first"><Input id="booking-first" type="date" required min={addDaysIso(today, 1)} value={firstDay} onChange={(e) => { setFirstDay(e.target.value); if (lastDay < e.target.value) setLastDay(e.target.value); }} className="min-h-11" /></Field>
        <Field label="Last day" htmlFor="booking-last"><Input id="booking-last" type="date" required min={firstDay} value={lastDay} onChange={(e) => setLastDay(e.target.value)} className="min-h-11" /></Field>
      </div>
      {lastDay > firstDay ? (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 font-semibold">Dates it does not run <span className="font-normal text-ui-muted-foreground">(optional)</span></legend>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Date" htmlFor="booking-skip">
              <Input id="booking-skip" type="date" min={firstDay} max={lastDay} value={skipDraft} onChange={(e) => setSkipDraft(e.target.value)} className="min-h-11" />
            </Field>
            <Button type="button" variant="outline" disabled={!skipDraft || skip.includes(skipDraft) || skipDraft < firstDay || skipDraft > lastDay}
              onClick={() => { setSkip((list) => [...list, skipDraft].sort()); setSkipDraft(""); }}><Plus aria-hidden="true" />Leave out</Button>
          </div>
          {inRange.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Dates it does not run">
              {inRange.map((d) => (
                <li key={d} className="flex items-center gap-1 rounded-[var(--pc-radius-control)] bg-[var(--pc-surface-sunken)] pl-3">
                  <span className="text-sm">{formatDate(new Date(`${d}T00:00:00Z`))}</span>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Run it on ${formatDate(new Date(`${d}T00:00:00Z`))} after all`} onClick={() => setSkip((list) => list.filter((x) => x !== d))}><X aria-hidden="true" /></Button>
                </li>
              ))}
            </ul>
          ) : null}
        </fieldset>
      ) : null}
      <Notice title={sessions ? `${sessions} ${sessions === 1 ? "day" : "days"} on the plan` : "No days yet"}
        description={sessions ? "Each day gets the activity with its places to fill." : "Choose the days, and a first and last day that include them."} />
    </FormDialog>
  );
}

/** Cancels the days still to come; anyone on them is told. Days that have come stay as they were. */
export function CancelBooking({ id, label }: { id: string; label: string }) {
  return (
    <FormDialog portalClassName={THEME} destructive cancelLabel="Keep it"
      trigger={<Button variant="outline"><X aria-hidden="true" />Cancel booking</Button>}
      title={`Cancel ${label}?`} description="Its days still to come leave the plan, with anyone on them. Days that have come stay as they were."
      submitLabel="Cancel booking" successMessage="Booking cancelled"
      submit={() => cancelRepeat(id)}>
      <p className="text-sm text-ui-muted-foreground">People on its days are told if their week is shared.</p>
    </FormDialog>
  );
}
