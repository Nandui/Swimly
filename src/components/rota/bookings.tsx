"use client";

import { useState } from "react";
import { CalendarPlus, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field, FormDialog } from "@/components/form-dialog";
import { Notice } from "@/components/ui-kit/notice";
import { cancelBooking, saveBooking, type BookingInput } from "@/lib/rota/actions";
import { BOOKING_KIND_META, BOOKING_KINDS, BOOKING_MAX_PLACES, WEEKDAY_LABELS, bookingDates } from "@/lib/rota/constants";

const THEME = "turnfin-module";
type Option = { id: string; name: string };
type Need = { key: number; role: string; count: number; requiredTypeId: string };

/** A new booking: what, who for, where, which days, when, and the staff each
 *  session needs. Saving it puts the places on the week plan, unfilled. */
export function BookingDialog({ siteId, today, departments, types }: { siteId: string; today: string; departments: Option[]; types: Option[] }) {
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [firstDay, setFirstDay] = useState(today);
  const [lastDay, setLastDay] = useState(today);
  const [needs, setNeeds] = useState<Need[]>([{ key: 1, role: "", count: 1, requiredTypeId: "" }]);
  const reset = () => { setDays([0, 1, 2, 3, 4]); setFirstDay(today); setLastDay(today); setNeeds([{ key: 1, role: "", count: 1, requiredTypeId: "" }]); };
  const sessions = firstDay && lastDay && lastDay >= firstDay ? bookingDates(firstDay, lastDay, days).length : 0;
  const places = sessions * needs.reduce((n, need) => n + (Number.isFinite(need.count) ? need.count : 0), 0);
  const setNeed = (key: number, patch: Partial<Need>) => setNeeds((list) => list.map((n) => (n.key === key ? { ...n, ...patch } : n)));

  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-2xl"
      onOpen={reset}
      trigger={<Button variant="outline" className="min-h-11"><CalendarPlus aria-hidden="true" />Add a booking</Button>}
      title="Add a booking"
      description="Something at the site that needs staff: school lessons, a party, lane hire. Each session shows on the week plan with its places to fill."
      submitLabel="Save booking"
      successMessage="Booking saved"
      submit={(formData) => saveBooking({
        siteId, kind: String(formData.get("kind") ?? "") as BookingInput["kind"], title: String(formData.get("title") ?? ""),
        place: String(formData.get("place") ?? ""), departmentId: String(formData.get("departmentId") ?? ""), weekdays: days,
        start: String(formData.get("start") ?? ""), end: String(formData.get("end") ?? ""), firstDay, lastDay,
        needs: needs.map(({ role, count, requiredTypeId }) => ({ role, count, requiredTypeId })), note: String(formData.get("note") ?? ""),
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What it is" htmlFor="booking-kind">
          <NativeSelect id="booking-kind" name="kind" defaultValue="school" className="min-h-11 w-full">
            {BOOKING_KINDS.map((k) => <NativeSelectOption key={k} value={k}>{BOOKING_KIND_META[k].label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Who it is for" htmlFor="booking-title" hint="For example the school's name."><Input id="booking-title" name="title" required minLength={2} maxLength={80} className="min-h-11" /></Field>
        <Field label="Where (optional)" htmlFor="booking-place" hint="For example Learner pool."><Input id="booking-place" name="place" maxLength={60} className="min-h-11" /></Field>
        <Field label="Department" htmlFor="booking-department">
          <NativeSelect id="booking-department" name="departmentId" defaultValue={departments[0]?.id ?? ""} className="min-h-11 w-full">
            <NativeSelectOption value="">No department</NativeSelectOption>
            {departments.map((d) => <NativeSelectOption key={d.id} value={d.id}>{d.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Which days</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={label} className="flex min-h-11 items-center gap-2">
              <Checkbox id={`booking-day-${i}`} checked={days.includes(i)} onCheckedChange={(v) => setDays((d) => (v === true ? [...d, i].sort() : d.filter((x) => x !== i)))} />
              <Label htmlFor={`booking-day-${i}`} className="font-normal">{label.slice(0, 3)}</Label>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Starts" htmlFor="booking-start"><Input id="booking-start" name="start" type="time" required defaultValue="09:30" className="min-h-11" /></Field>
        <Field label="Ends" htmlFor="booking-end"><Input id="booking-end" name="end" type="time" required defaultValue="11:30" className="min-h-11" /></Field>
        <Field label="First day" htmlFor="booking-first"><Input id="booking-first" type="date" required min={today} value={firstDay} onChange={(e) => { setFirstDay(e.target.value); if (lastDay < e.target.value) setLastDay(e.target.value); }} className="min-h-11" /></Field>
        <Field label="Last day" htmlFor="booking-last"><Input id="booking-last" type="date" required min={firstDay} value={lastDay} onChange={(e) => setLastDay(e.target.value)} className="min-h-11" /></Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Staff each session needs</legend>
        {needs.map((n, i) => (
          <div key={n.key} className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)_auto]">
            <Field label="Role" htmlFor={`booking-role-${n.key}`}><Input id={`booking-role-${n.key}`} required minLength={2} maxLength={40} value={n.role} onChange={(e) => setNeed(n.key, { role: e.target.value })} placeholder={i ? "Lifeguard" : "Swim teacher"} className="min-h-11" /></Field>
            <Field label="How many" htmlFor={`booking-count-${n.key}`}><Input id={`booking-count-${n.key}`} type="number" required min={1} max={20} value={n.count} onChange={(e) => setNeed(n.key, { count: Number(e.target.value) })} className="min-h-11" /></Field>
            <div className="col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto">
              <Field label="Needs a qualification" htmlFor={`booking-type-${n.key}`}>
                <NativeSelect id={`booking-type-${n.key}`} value={n.requiredTypeId} onChange={(e) => setNeed(n.key, { requiredTypeId: e.target.value })} className="min-h-11 w-full">
                  <NativeSelectOption value="">None</NativeSelectOption>
                  {types.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Remove role ${i + 1}`} disabled={needs.length === 1} onClick={() => setNeeds((list) => list.filter((x) => x.key !== n.key))}><Trash2 aria-hidden="true" /></Button>
          </div>
        ))}
        {needs.length < 8 ? <Button type="button" variant="ghost" className="min-h-11" onClick={() => setNeeds((list) => [...list, { key: Math.max(...list.map((x) => x.key)) + 1, role: "", count: 1, requiredTypeId: "" }])}><Plus aria-hidden="true" />Add another role</Button> : null}
      </fieldset>
      <Field label="Note (optional)" htmlFor="booking-note"><Input id="booking-note" name="note" maxLength={300} className="min-h-11" /></Field>
      <Notice title={sessions ? `${sessions} ${sessions === 1 ? "session" : "sessions"}, ${places} ${places === 1 ? "place" : "places"} to fill` : "No sessions yet"}
        description={places > BOOKING_MAX_PLACES ? `That is over ${BOOKING_MAX_PLACES} places: split it into shorter bookings.` : sessions ? "Plan who does them on the week plan, or copy last week once the first week is set." : "Choose the days, and a first and last day that include them."} />
    </FormDialog>
  );
}

/** Cancels the sessions still to come. People already on one in a started
 *  week are taken off with a reason. */
export function CancelBooking({ id, label, staffedThisWeek }: { id: string; label: string; staffedThisWeek: boolean }) {
  const [reason, setReason] = useState("correction");
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="ghost" className="min-h-11 text-[var(--pc-danger)]"><X aria-hidden="true" />Cancel booking</Button>}
      title={`Cancel ${label}?`}
      description="Its sessions still to come come off the plan. Past sessions stay as they were."
      submitLabel="Cancel booking"
      successMessage="Booking cancelled"
      submit={(formData) => cancelBooking(id, staffedThisWeek ? { reason: reason as "correction", changeNote: String(formData.get("changeNote") ?? ""), timepoint: formData.get("timepoint") === "on" } : {})}
    >
      {staffedThisWeek ? (
        <>
          <Field label="Why" htmlFor={`booking-cancel-${id}`} hint="People this week are on its places, so it is kept with the reason.">
            <NativeSelect id={`booking-cancel-${id}`} value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-11 w-full">
              <NativeSelectOption value="correction">Correcting a mistake in the plan</NativeSelectOption>
              <NativeSelectOption value="swap">Swap agreed between staff</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field label="Note (optional)" htmlFor={`booking-cancel-note-${id}`}><Input id={`booking-cancel-note-${id}`} name="changeNote" maxLength={200} placeholder="The school cancelled for the term" className="min-h-11" /></Field>
          <div className="flex min-h-11 items-center gap-3"><Checkbox id={`booking-cancel-tp-${id}`} name="timepoint" /><Label htmlFor={`booking-cancel-tp-${id}`} className="font-normal">Updated in Timepoint</Label></div>
        </>
      ) : <p className="sr-only">Confirm to cancel.</p>}
    </FormDialog>
  );
}
