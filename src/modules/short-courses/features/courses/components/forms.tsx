"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ClipboardCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { PlaceLanesField, type AreaWithLanes } from "@/components/ui/lane-picker";
import { linkParticipant, removeSession, saveCourse, saveParticipant, saveSession, setCourseStatus, setPlace, takeRegister } from "@/modules/short-courses/features/courses/server/actions";
import { clock, clockOf, MAX_WEEKS, SHORT_COURSE_PAYMENT_META, SHORT_COURSE_PAYMENTS } from "@/modules/short-courses/shared/rules";
import { amount, PersonSelect, text, THEME, useRefresh, type Option, type Person } from "@/modules/short-courses/shared/components/form-kit";
import { BirthDateField, SwimmerCard, SwimmerLinkDialog, type SwimmerCardData } from "@/modules/short-courses/shared/components/swimmer-card";
import { readSwimmerChoice, SwimmerPicker, type PickedSwimmer } from "@/modules/short-courses/shared/components/swimmer-picker";

/** The course dialogs (docs/short-courses.md): putting a course on, its sessions, booking people
 *  and the waiting list, and registers. */

/* ---------- Courses ---------- */

export type CourseEdit = { id: string; siteId: string; typeId: string; capacity: number; priceCents: number; instructorId: string; note: string; bookOnline: boolean };
type TypeOption = Option & { area: string; weeks: number; sessionMinutes: number };
type SiteOptions = { siteId: string; people: Person[]; areas: AreaWithLanes[] };

/** Put a course on with its weekly sessions, or change its places, price and instructor. */
export function CourseDialog({ course, sites, types, perSite, today, trigger }: {
  course?: CourseEdit; sites: Option[]; types: TypeOption[]; perSite: SiteOptions[]; today: string; trigger?: ReactNode;
}) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(course?.siteId ?? sites[0]?.id ?? "");
  const [typeId, setTypeId] = useState(course?.typeId ?? types[0]?.id ?? "");
  const type = types.find((t) => t.id === typeId);
  const [weeks, setWeeks] = useState(String(type?.weeks ?? 6));
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState(clock(18 * 60 + (type?.sessionMinutes ?? 60)));
  const here = perSite.find((s) => s.siteId === siteId);
  const fid = course ? `sc-${course.id}` : "sc-new";
  const pickType = (id: string) => {
    setTypeId(id);
    const t = types.find((x) => x.id === id);
    const from = clockOf(start);
    if (t) { setWeeks(String(t.weeks)); if (from !== null) setEnd(clock(Math.min(from + t.sessionMinutes, 23 * 60 + 55))); }
  };
  const pickStart = (value: string) => {
    setStart(value);
    const from = clockOf(value);
    if (from !== null && type) setEnd(clock(Math.min(from + type.sessionMinutes, 23 * 60 + 55)));
  };
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={trigger ?? <Button><CalendarPlus aria-hidden="true" />Put a course on</Button>}
      title={course ? "Change the course" : "Put a course on"}
      description={course ? "Its sessions and people stay. Move a single week on the session itself." : "A session is made each week from the first day. Move any one of them afterwards."}
      submitLabel={course ? "Save course" : "Put it on"} successMessage={course ? "Course saved" : "Course put on"}
      submit={async (fd) => {
        const result = await saveCourse(course?.id ?? null, {
          siteId, typeId, capacity: Number(fd.get("capacity") || 0), price: text(fd, "price"), instructorId: text(fd, "instructorId"), note: text(fd, "note"),
          bookOnline: fd.get("bookOnline") === "on", firstDay: text(fd, "firstDay"), weeks: Number(weeks || 0), start, end, place: text(fd, "place"),
        });
        if (result.ok && !course && result.id) router.push(`/short-courses/${result.id}`);
        else if (result.ok) router.refresh();
        return result;
      }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Course" htmlFor={`${fid}-type`}>
          <NativeSelect id={`${fid}-type`} value={typeId} onChange={(e) => pickType(e.target.value)} disabled={!!course} className="min-h-11 w-full">
            {types.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Site" htmlFor={`${fid}-site`}>
          <NativeSelect id={`${fid}-site`} value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={!!course} className="min-h-11 w-full">
            {sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        {!course ? <>
          <Field label="First day" htmlFor={`${fid}-first`}><Input id={`${fid}-first`} name="firstDay" type="date" required min={today} className="min-h-11" /></Field>
          <Field label="Weeks" htmlFor={`${fid}-weeks`} hint="Same day and time each week."><Input id={`${fid}-weeks`} type="number" min={1} max={MAX_WEEKS} required value={weeks} onChange={(e) => setWeeks(e.target.value)} className="min-h-11" /></Field>
          <Field label="Starts" htmlFor={`${fid}-start`}><Input id={`${fid}-start`} type="time" step={300} required value={start} onChange={(e) => pickStart(e.target.value)} className="min-h-11" /></Field>
          <Field label="Ends" htmlFor={`${fid}-end`}><Input id={`${fid}-end`} type="time" step={300} required value={end} onChange={(e) => setEnd(e.target.value)} className="min-h-11" /></Field>
          <PlaceLanesField key={siteId} fid={`${fid}-place`} name="place" areas={here?.areas ?? []} hint="The site's areas, kept in Admin. A pool with lanes is booked whole or by lane." />
        </> : null}
        <Field label="Instructor" htmlFor={`${fid}-instructor`}><PersonSelect key={siteId} id={`${fid}-instructor`} name="instructorId" people={here?.people ?? []} defaultValue={course?.instructorId} /></Field>
        <Field label="Places" htmlFor={`${fid}-cap`}><Input id={`${fid}-cap`} name="capacity" type="number" min={1} max={200} required defaultValue={course?.capacity ?? 12} className="min-h-11" /></Field>
        <Field label="Price (€)" htmlFor={`${fid}-price`} hint="For the whole course."><Input id={`${fid}-price`} name="price" inputMode="decimal" defaultValue={course ? amount(course.priceCents) : ""} placeholder="90" className="min-h-11" /></Field>
      </div>
      {type?.area === "pool" ? (
        <div className="flex items-start gap-3">
          <Checkbox id={`${fid}-app`} name="bookOnline" defaultChecked={course?.bookOnline ?? false} className="mt-1" />
          <Label htmlFor={`${fid}-app`} className="grid gap-1 font-normal">
            <span className="font-medium">Show in the parents app</span>
            <span className="text-sm text-ui-muted-foreground">People hold a place until the first session and the desk phones them within 72 hours to take payment. 18 and over goes to adults, younger to parents.</span>
          </Label>
        </div>
      ) : null}
      <Field label="Note" htmlFor={`${fid}-note`} optional><Textarea id={`${fid}-note`} name="note" maxLength={500} defaultValue={course?.note} /></Field>
    </FormDialog>
  );
}

export function CourseStatusButton({ id, to, label, title, description, destructive }: { id: string; to: "planned" | "finished" | "cancelled"; label: string; title: string; description: string; destructive?: boolean }) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} destructive={destructive} cancelLabel="Not now" title={title} description={description}
      trigger={<Button type="button" variant={destructive ? "ghost" : "outline"} className={destructive ? "text-ui-destructive" : undefined}>{label}</Button>}
      submitLabel={label} successMessage="Course updated" onSuccess={refresh} submit={() => setCourseStatus(id, to)}>
      <p className="text-sm text-ui-muted-foreground">It is in the course&apos;s history.</p>
    </FormDialog>
  );
}

/* ---------- Sessions ---------- */

export type SessionEdit = { id: string; date: string; startMinutes: number; endMinutes: number; place: string; note: string };

export function SessionDialog({ courseId, session, areas, suggest, trigger }: { courseId: string; session?: SessionEdit; areas: AreaWithLanes[]; suggest?: Omit<SessionEdit, "id" | "note">; trigger?: ReactNode }) {
  const refresh = useRefresh();
  const fid = session ? `scs-${session.id}` : "scs-new";
  const base = session ?? suggest;
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={trigger ?? <Button variant="outline"><CalendarPlus aria-hidden="true" />Add a session</Button>}
      title={session ? "Change the session" : "Add a session"} description="It shows on the Rota in its area for the instructor."
      submitLabel={session ? "Save session" : "Add session"} successMessage={session ? "Session saved" : "Session added"} onSuccess={refresh}
      submit={(fd) => saveSession(courseId, session?.id ?? null, { date: text(fd, "date"), start: text(fd, "start"), end: text(fd, "end"), place: text(fd, "place"), note: text(fd, "note") })}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Day" htmlFor={`${fid}-date`}><Input id={`${fid}-date`} name="date" type="date" required defaultValue={base?.date} className="min-h-11" /></Field>
        <Field label="Starts" htmlFor={`${fid}-start`}><Input id={`${fid}-start`} name="start" type="time" step={300} required defaultValue={clock(base?.startMinutes ?? 1080)} className="min-h-11" /></Field>
        <Field label="Ends" htmlFor={`${fid}-end`}><Input id={`${fid}-end`} name="end" type="time" step={300} required defaultValue={clock(base?.endMinutes ?? 1140)} className="min-h-11" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2"><PlaceLanesField fid={`${fid}-place`} name="place" areas={areas} defaultValue={base?.place} hint="The site's areas, kept in Admin." /></div>
      <Field label="Note" htmlFor={`${fid}-note`} optional><Input id={`${fid}-note`} name="note" maxLength={200} defaultValue={session?.note} placeholder="Moved for the bank holiday" className="min-h-11" /></Field>
      {session ? (
        <div>
          <FormDialog portalClassName={THEME} destructive cancelLabel="Keep it" title="Remove this session?" description="Only before its register is taken."
            trigger={<Button type="button" variant="ghost" className="text-ui-destructive">Remove session</Button>}
            submitLabel="Remove" successMessage="Session removed" onSuccess={refresh} submit={() => removeSession(session.id)}>
            <p className="text-sm text-ui-muted-foreground">It leaves the Rota too.</p>
          </FormDialog>
        </div>
      ) : null}
    </FormDialog>
  );
}

/** A session's register: everyone booked is ticked as there; untick whoever was not. */
export function RegisterDialog({ session, people, trigger }: {
  session: { id: string; label: string; marks: Record<string, boolean>; taken: boolean };
  people: { id: string; name: string; memberNumber?: string | null; medical?: boolean }[]; trigger?: ReactNode;
}) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={trigger ?? <Button variant={session.taken ? "ghost" : "outline"}><ClipboardCheck aria-hidden="true" />{session.taken ? "Change register" : "Take register"}</Button>}
      title={`Register: ${session.label}`} description="Untick anyone who was not there."
      submitLabel="Save register" successMessage="Register saved" onSuccess={refresh}
      submit={(fd) => takeRegister(session.id, people.filter((p) => fd.get(`there-${p.id}`)).map((p) => p.id))}>
      {people.length === 0 ? <p className="text-sm">Nobody is booked on the course yet.</p> : (
        <ul className="pc-rows">
          {people.map((p) => (
            <li key={p.id} className="pc-row">
              <Checkbox id={`screg-${session.id}-${p.id}`} name={`there-${p.id}`} defaultChecked={session.taken ? session.marks[p.id] ?? false : true} />
              <Label htmlFor={`screg-${session.id}-${p.id}`} className="pc-row-body font-normal">
                <span className="pc-row-title">{p.name}</span>
                {p.memberNumber || p.medical ? <span className="pc-row-hint">{[p.memberNumber ? `Member ${p.memberNumber}` : null, p.medical ? "Medical notes on file" : null].filter(Boolean).join(" · ")}</span> : null}
              </Label>
            </li>
          ))}
        </ul>
      )}
    </FormDialog>
  );
}

/* ---------- People ---------- */

export type PersonEdit = { id: string; name: string; email: string; phone: string; dateOfBirth: string | null; payment: string; paidCents: number; healthFormOn: string | null; note: string;
  swimmerId: string | null; swimmer: SwimmerCardData | null };

/** Book someone on, or onto the waiting list when the course is full; or change their payment and
 *  health form. A new booking starts with "Find the swimmer" (owner request, 21 October 2026): the
 *  person is picked on the swimmer records or added there. With the swim school switched off, and
 *  for older bookings not linked yet, their name and contacts are typed here as before. */
export function PersonDialog({ courseId, person, priceCents, full, healthForm, minAge, swimmerRecords, canOpenSwimmers, trigger }: {
  courseId: string; person?: PersonEdit; priceCents: number; full: boolean; healthForm: boolean; minAge: number | null;
  swimmerRecords: boolean; canOpenSwimmers: boolean; trigger?: ReactNode;
}) {
  const refresh = useRefresh();
  const fid = person ? `scp-${person.id}` : "scp-new";
  const waiting = !person && full;
  const [picked, setPicked] = useState<PickedSwimmer | "new" | null>(null);
  const picking = swimmerRecords && !person;
  const typed = !picking && !person?.swimmerId;
  const linkedNoBirth = Boolean(person?.swimmerId) && !person?.swimmer?.dateOfBirth && !person?.dateOfBirth;
  const askBirth = !!minAge && ((picked && picked !== "new" && !picked.dateOfBirth) || linkedNoBirth);
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={trigger ?? <Button variant={waiting ? "outline" : "default"}><UserPlus aria-hidden="true" />{waiting ? "Add to waiting list" : "Book someone on"}</Button>}
      title={person ? `Change ${person.name}` : waiting ? "Add to the waiting list" : "Book someone on"}
      description={waiting ? "The course is full. They are offered the next free place, in the order they were added." : picking ? "Find them on the swimmer records, or add them there. Payment is taken at the till and recorded here." : "Payment is taken at the till and recorded here."}
      submitLabel={person ? "Save" : waiting ? "Add to waiting list" : "Book on"} successMessage={person ? "Saved" : waiting ? "Added to the waiting list" : "Booked on"}
      onSuccess={() => { setPicked(null); refresh(); }} onClose={() => setPicked(null)}
      submit={(fd) => saveParticipant(courseId, person?.id ?? null, {
        name: text(fd, "name"), email: text(fd, "email"), phone: text(fd, "phone"), dateOfBirth: text(fd, "dateOfBirth"),
        payment: text(fd, "payment"), paid: text(fd, "paid"), healthFormOn: text(fd, "healthFormOn"), note: text(fd, "note"), waiting,
        swimmer: picking ? readSwimmerChoice(fd) : undefined,
      })}>
      {picking ? <SwimmerPicker fid={fid} needsDateOfBirth={!!minAge} onPick={setPicked} /> : null}
      {person?.swimmer ? <SwimmerCard swimmer={person.swimmer} canOpen={canOpenSwimmers} /> : null}
      {person?.swimmerId && !person.swimmer ? <p className="pc-row-hint">Linked to a swimmer record that cannot be read right now; the details copied when it was linked are kept.</p> : null}
      {person && typed && swimmerRecords ? <p className="pc-row-hint">Booked before the swimmer records. Use Link to swimmer on their row to match them.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {typed ? <>
          <Field label="Name" htmlFor={`${fid}-name`}><Input id={`${fid}-name`} name="name" required minLength={2} maxLength={120} defaultValue={person?.name} className="min-h-11" /></Field>
          <Field label="Phone" htmlFor={`${fid}-phone`} optional><Input id={`${fid}-phone`} name="phone" type="tel" maxLength={40} defaultValue={person?.phone} className="min-h-11" /></Field>
          <Field label="Email" htmlFor={`${fid}-email`} optional><Input id={`${fid}-email`} name="email" type="email" maxLength={200} defaultValue={person?.email} className="min-h-11" /></Field>
          <Field label="Date of birth" htmlFor={`${fid}-dob`} optional={!minAge} hint={minAge ? `The course is for ${minAge} and over.` : undefined}>
            <Input id={`${fid}-dob`} name="dateOfBirth" type="date" required={!!minAge} defaultValue={person?.dateOfBirth ?? ""} className="min-h-11" />
          </Field>
        </> : askBirth && minAge ? <BirthDateField fid={fid} defaultValue={person?.dateOfBirth} minAge={minAge} /> : null}
        <Field label="Payment" htmlFor={`${fid}-pay`}>
          <NativeSelect id={`${fid}-pay`} name="payment" defaultValue={person?.payment ?? "owed"} className="min-h-11 w-full">
            {SHORT_COURSE_PAYMENTS.map((p) => <NativeSelectOption key={p} value={p}>{SHORT_COURSE_PAYMENT_META[p].label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Paid so far (€)" htmlFor={`${fid}-paid`} optional hint={priceCents ? `The course is €${amount(priceCents)}.` : undefined}>
          <Input id={`${fid}-paid`} name="paid" inputMode="decimal" defaultValue={person && person.paidCents ? amount(person.paidCents) : ""} className="min-h-11" />
        </Field>
        {healthForm ? <Field label="Health form received on" htmlFor={`${fid}-health`} optional><Input id={`${fid}-health`} name="healthFormOn" type="date" defaultValue={person?.healthFormOn ?? ""} className="min-h-11" /></Field> : null}
      </div>
      <Field label="Note" htmlFor={`${fid}-note`} optional><Textarea id={`${fid}-note`} name="note" maxLength={500} defaultValue={person?.note} /></Field>
    </FormDialog>
  );
}

/** Link a booking made before the swimmer records, or held online, to the person's record. */
export function LinkPersonButton({ id, name, email, phone, dateOfBirth, minAge }: { id: string; name: string; email: string; phone: string; dateOfBirth: string | null; minAge: number | null }) {
  return <SwimmerLinkDialog name={name} needsDateOfBirth={!!minAge} prefill={{ contactEmail: email, contactPhone: phone, dateOfBirth: dateOfBirth ?? undefined }}
    submit={(choice) => linkParticipant(id, choice)} />;
}

/** Move someone between a place, the waiting list and withdrawn. */
export function PlaceButton({ id, name, to, label, title, description, destructive, primary }: {
  id: string; name: string; to: "booked" | "waiting" | "withdrawn"; label: string; title: string; description: string; destructive?: boolean; primary?: boolean;
}) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} destructive={destructive} cancelLabel="Not now" title={title} description={description}
      trigger={<Button type="button" variant={primary ? "default" : "ghost"} className={destructive ? "text-ui-destructive" : undefined} aria-label={`${label}: ${name}`}>{label}</Button>}
      submitLabel={label} successMessage="Done" onSuccess={refresh} submit={() => setPlace(id, to)}>
      <p className="text-sm text-ui-muted-foreground">Any refund is handled at the till.</p>
    </FormDialog>
  );
}
