"use client";

import { useState, type ReactNode } from "react";
import { CalendarPlus, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field, FormDialog } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { Notice } from "@/components/ui-kit/notice";
import { cancelBooking, saveBooking, type BookingInput } from "@/lib/rota/actions";
import { formatDate } from "@/lib/format";
import { BOOKING_KIND_META, BOOKING_KINDS, BOOKING_MAX_PLACES, WEEKDAY_LABELS, bookingDates, nextWeekday } from "@/lib/rota/constants";

const THEME = "turnfin-module";
type Option = { id: string; name: string };
type Need = { key: number; role: string; count: number; requiredTypeId: string };
const WEEKDAYS = [0, 1, 2, 3, 4];

/** Monday = 0 to Sunday = 6, as bookings store them. */
const weekdayOf = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;

/** A new booking: what, who for, where, which days, when, the dates it does not run, and the
 *  staff each session needs. Saving it puts the places on the week plan, unfilled. The week
 *  planner opens it from a stretch dragged on a day's timeline (`preset`): that day, those times,
 *  that weekday, and the department shown; stretching the last day makes it repeat. */
export function BookingDialog({ siteId, today, departments, types, preset, department, defaultOpen, onClose, trigger, outline }: {
  siteId: string; today: string; departments: Option[]; types: Option[];
  preset?: { date: string; start: string; end: string };
  department?: string;
  defaultOpen?: boolean;
  onClose?: () => void;
  /** A client-side trigger of the caller's own (a server page passes `outline` instead). */
  trigger?: ReactNode;
  /** The quieter "Add booking" button, for a header with a primary action of its own. */
  outline?: boolean;
}) {
  // The first and last day start on the next ticked weekday, so a weekend opening still has a session.
  const start = preset?.date ?? nextWeekday(today, WEEKDAYS);
  const startDays = preset ? [weekdayOf(preset.date)] : WEEKDAYS;
  const [days, setDays] = useState<number[]>(startDays);
  const [firstDay, setFirstDay] = useState(start);
  const [lastDay, setLastDay] = useState(start);
  const [skip, setSkip] = useState<string[]>([]);
  const [skipDraft, setSkipDraft] = useState("");
  const [needs, setNeeds] = useState<Need[]>([{ key: 1, role: "", count: 1, requiredTypeId: "" }]);
  const reset = () => { setDays(startDays); setFirstDay(start); setLastDay(start); setSkip([]); setSkipDraft(""); setNeeds([{ key: 1, role: "", count: 1, requiredTypeId: "" }]); };
  const inRange = skip.filter((d) => d >= firstDay && d <= lastDay);
  const sessions = firstDay && lastDay && lastDay >= firstDay ? bookingDates(firstDay, lastDay, days, inRange).length : 0;
  const places = sessions * needs.reduce((n, need) => n + (Number.isFinite(need.count) ? need.count : 0), 0);
  const setNeed = (key: number, patch: Partial<Need>) => setNeeds((list) => list.map((n) => (n.key === key ? { ...n, ...patch } : n)));

  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-2xl"
      onOpen={reset}
      defaultOpen={defaultOpen}
      onClose={onClose}
      trigger={trigger ?? (outline ? <Button variant="outline"><CalendarPlus aria-hidden="true" />Add booking</Button> : <Button><Plus aria-hidden="true" />New booking</Button>)}
      title="New booking"
      description="Something at the site that needs staff: school lessons, a party, lane hire. Each session shows on the week plan with its places to fill."
      submitLabel="Save booking"
      successMessage="Booking saved"
      submit={(formData) => saveBooking({
        siteId, kind: String(formData.get("kind") ?? "") as BookingInput["kind"], title: String(formData.get("title") ?? ""),
        place: String(formData.get("place") ?? ""), departmentId: String(formData.get("departmentId") ?? ""), weekdays: days,
        start: String(formData.get("start") ?? ""), end: String(formData.get("end") ?? ""), firstDay, lastDay, skipDates: inRange,
        needs: needs.map(({ role, count, requiredTypeId }) => ({ role, count, requiredTypeId })), note: String(formData.get("note") ?? ""),
      })}
    >
      <div className="grid items-end gap-4 sm:grid-cols-2">
        <Field label="What it is" htmlFor="booking-kind">
          <NativeSelect id="booking-kind" name="kind" defaultValue="school" className="min-h-11 w-full">
            {BOOKING_KINDS.map((k) => <NativeSelectOption key={k} value={k}>{BOOKING_KIND_META[k].label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Who it is for" htmlFor="booking-title" hint="For example the school's name."><Input id="booking-title" name="title" required minLength={2} maxLength={80} className="min-h-11" /></Field>
        <Field label="Where" htmlFor="booking-place" optional hint="For example Learner pool."><Input id="booking-place" name="place" maxLength={60} className="min-h-11" /></Field>
        <Field label="Department" htmlFor="booking-department">
          <NativeSelect id="booking-department" name="departmentId" defaultValue={department ?? departments[0]?.id ?? ""} className="min-h-11 w-full">
            <NativeSelectOption value="">No department</NativeSelectOption>
            {departments.map((d) => <NativeSelectOption key={d.id} value={d.id}>{d.name}</NativeSelectOption>)}
          </NativeSelect>
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Starts" htmlFor="booking-start"><Input id="booking-start" name="start" type="time" required step={900} defaultValue={preset?.start ?? "09:30"} className="min-h-11" /></Field>
        <Field label="Ends" htmlFor="booking-end"><Input id="booking-end" name="end" type="time" required step={900} defaultValue={preset?.end ?? "11:30"} className="min-h-11" /></Field>
        <Field label="First day" htmlFor="booking-first"><Input id="booking-first" type="date" required min={today} value={firstDay} onChange={(e) => { setFirstDay(e.target.value); if (lastDay < e.target.value) setLastDay(e.target.value); }} className="min-h-11" /></Field>
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
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 font-semibold">Staff each session needs</legend>
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
      <Field label="Note" htmlFor="booking-note" optional><Input id="booking-note" name="note" maxLength={300} className="min-h-11" /></Field>
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
      trigger={<Button variant="outline"><X aria-hidden="true" />Cancel booking</Button>}
      title={`Cancel ${label}?`}
      description="Its sessions still to come come off the plan. Past sessions stay as they were."
      submitLabel="Cancel booking"
      cancelLabel="Keep it"
      destructive
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
          <Field label="Note" htmlFor={`booking-cancel-note-${id}`} optional><Input id={`booking-cancel-note-${id}`} name="changeNote" maxLength={200} placeholder="The school cancelled for the term" className="min-h-11" /></Field>
          <ChoiceRow type="checkbox" id={`booking-cancel-tp-${id}`} name="timepoint" title="Updated in Timepoint" hint="Leave it unticked if you will do it later: it stays a follow-up until it is done." />
        </>
      ) : null}
    </FormDialog>
  );
}
