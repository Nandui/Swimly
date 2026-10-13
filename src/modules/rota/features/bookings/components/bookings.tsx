"use client";

import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field, FormDialog } from "@/components/form-dialog";
import { AreaSelect } from "@/components/ui/area-select";
import { Notice } from "@/components/ui-kit/notice";
import { cancelRepeat, editRepeat, saveRepeat, type RepeatInput } from "@/modules/rota/features/bookings/server/actions";
import { formatDate } from "@/lib/format";
import { BOOKING_KIND_META, BOOKING_KINDS, WEEKDAY_LABELS, addDaysIso, bookingDates, nextWeekday } from "@/modules/rota/shared/constants";

const THEME = "turnfin-module";
type Option = { id: string; name: string };
const WEEKDAYS = [0, 1, 2, 3, 4];
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** A booking as the dialog shows it, to change one already made. Times are "09:30", dates ISO. */
export type BookingValues = {
  id: string; kind: string; title: string; typeId: string; place: string; start: string; end: string; places: number;
  weekdays: number[]; firstDay: string; lastDay: string; skipDates: string[];
};

/** A booking that repeats (owner decision, 6 October 2026): school lessons, a party, lane hire.
 *  It is one activity on each of its days, from tomorrow on; each day is then planned and changed
 *  on its own on the Plan. With `booking`, it changes one already made (owner request, 13 October
 *  2026): only its days still to come, and its first day stays once it has started. */
export function BookingDialog({ siteId, today, types, places, booking }: { siteId: string; today: string; types: Option[]; places: string[]; booking?: BookingValues }) {
  const tomorrow = addDaysIso(today, 1);
  const start = nextWeekday(tomorrow, WEEKDAYS);
  const started = !!booking && booking.firstDay <= today;
  const initial = { days: booking?.weekdays ?? WEEKDAYS, firstDay: booking?.firstDay ?? start, lastDay: booking?.lastDay ?? start, skip: booking?.skipDates ?? [] };
  const [days, setDays] = useState<number[]>(initial.days);
  const [firstDay, setFirstDay] = useState(initial.firstDay);
  const [lastDay, setLastDay] = useState(initial.lastDay);
  const [skip, setSkip] = useState<string[]>(initial.skip);
  const [skipDraft, setSkipDraft] = useState("");
  const reset = () => { setDays(initial.days); setFirstDay(initial.firstDay); setLastDay(initial.lastDay); setSkip(initial.skip); setSkipDraft(""); };
  // Only days still to come are made or changed.
  const from = firstDay > today ? firstDay : tomorrow;
  const inRange = skip.filter((d) => d >= from && d <= lastDay);
  const sessions = firstDay && lastDay && lastDay >= from ? bookingDates(from, lastDay, days, inRange).length : 0;
  const id = (name: string) => `booking-${booking?.id ?? "new"}-${name}`;
  const values = (formData: FormData): RepeatInput => ({
    siteId, kind: text(formData, "kind") as RepeatInput["kind"], title: text(formData, "title"), typeId: text(formData, "typeId"), place: text(formData, "place"),
    start: text(formData, "start"), end: text(formData, "end"), places: Number(formData.get("places") ?? 1), weekdays: days, firstDay, lastDay, skipDates: inRange,
  });
  const typeKnown = !booking || types.some((t) => t.id === booking.typeId);
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-2xl" onOpen={reset}
      trigger={booking ? <Button variant="outline"><Pencil aria-hidden="true" />Change</Button> : <Button><Plus aria-hidden="true" />New booking</Button>}
      title={booking ? `Change ${booking.title}` : "New booking"}
      description={booking ? "Changes reach its days still to come. Days that have come stay as they were." : "It adds its activity on each of its days, ready to plan who on the Plan."}
      submitLabel={booking ? "Save changes" : "Save booking"} successMessage={booking ? "Booking changed" : "Booking saved"}
      submit={(formData) => booking ? editRepeat(booking.id, values(formData)) : saveRepeat(values(formData))}>
      <div className="grid items-end gap-4 sm:grid-cols-2">
        <Field label="What it is" htmlFor={id("kind")}>
          <NativeSelect id={id("kind")} name="kind" defaultValue={booking?.kind ?? "school"} className="min-h-11 w-full">
            {BOOKING_KINDS.map((k) => <NativeSelectOption key={k} value={k}>{BOOKING_KIND_META[k].label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Who it is for" htmlFor={id("title")} hint="For example the school's name."><Input id={id("title")} name="title" defaultValue={booking?.title} required minLength={2} maxLength={80} className="min-h-11" /></Field>
        <Field label="Activity it needs" htmlFor={id("type")} hint={typeKnown ? undefined : "Its activity is no longer on the list. Choose another."}>
          <NativeSelect id={id("type")} name="typeId" required defaultValue={booking ? (typeKnown ? booking.typeId : "") : types[0]?.id ?? ""} className="min-h-11 w-full">
            {typeKnown ? null : <NativeSelectOption value="" disabled>Choose the activity</NativeSelectOption>}
            {types.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Where" htmlFor={id("place")} optional hint="The site's areas, kept in Admin.">
          <AreaSelect id={id("place")} name="place" areas={places} defaultValue={booking?.place} />
        </Field>
      </div>
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 font-semibold">Which days</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={label} className="flex min-h-11 items-center gap-2">
              <Checkbox id={id(`day-${i}`)} checked={days.includes(i)} onCheckedChange={(v) => setDays((d) => (v === true ? [...d, i].sort() : d.filter((x) => x !== i)))} />
              <Label htmlFor={id(`day-${i}`)} className="font-normal">{label.slice(0, 3)}</Label>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Field label="Starts" htmlFor={id("start")}><Input id={id("start")} name="start" type="time" required step={300} defaultValue={booking?.start ?? "09:30"} className="min-h-11" /></Field>
        <Field label="Ends" htmlFor={id("end")}><Input id={id("end")} name="end" type="time" required step={300} defaultValue={booking?.end ?? "11:30"} className="min-h-11" /></Field>
        <Field label="People" htmlFor={id("places")}><Input id={id("places")} name="places" type="number" required min={1} max={20} defaultValue={booking?.places ?? 1} className="min-h-11" /></Field>
        <Field label="First day" htmlFor={id("first")} hint={started ? "It has started, so this stays." : undefined}><Input id={id("first")} type="date" required disabled={started} min={started ? undefined : tomorrow} value={firstDay} onChange={(e) => { setFirstDay(e.target.value); if (lastDay < e.target.value) setLastDay(e.target.value); }} className="min-h-11" /></Field>
        <Field label="Last day" htmlFor={id("last")}><Input id={id("last")} type="date" required min={started ? today : firstDay} value={lastDay} onChange={(e) => setLastDay(e.target.value)} className="min-h-11" /></Field>
      </div>
      {lastDay > from ? (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 font-semibold">Dates it does not run <span className="font-normal text-ui-muted-foreground">(optional)</span></legend>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Date" htmlFor={id("skip")}>
              <Input id={id("skip")} type="date" min={from} max={lastDay} value={skipDraft} onChange={(e) => setSkipDraft(e.target.value)} className="min-h-11" />
            </Field>
            <Button type="button" variant="outline" disabled={!skipDraft || skip.includes(skipDraft) || skipDraft < from || skipDraft > lastDay}
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
      <Notice title={sessions ? `${sessions} ${sessions === 1 ? "day" : "days"} ${started ? "still to come " : ""}on the plan` : started ? "No days still to come" : "No days yet"}
        description={sessions ? (booking ? "Days it no longer runs leave the plan, with anyone on them, who are told. New days get the activity with its places to fill." : "Each day gets the activity with its places to fill.")
          : started ? "It ends here: its days still to come leave the plan, with anyone on them." : "Choose the days, and a first and last day that include them."} />
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
