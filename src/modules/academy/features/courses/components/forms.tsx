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
import { AreaSelect } from "@/components/ui/area-select";
import {
  recordChecks, recordResult, removeSession, saveCandidate, saveCourse, saveSession, setCourseStatus, setWithdrawn, takeRegister,
} from "@/modules/academy/features/courses/server/actions";
import { ACADEMY_OUTCOMES, ACADEMY_PAYMENT_META, ACADEMY_PAYMENTS, ACADEMY_RESULT_META } from "@/modules/academy/shared/rules";

import { PersonSelect, pounds, text, THEME, useRefresh, type Option, type Person } from "@/modules/academy/shared/components/form-kit";

/** The Academy's course dialogs (docs/academy.md): putting a course on, its sessions,
 *  candidates, pre-course checks, registers and results. */

/* ---------- Courses ---------- */

export type CourseEdit = { id: string; siteId: string; typeId: string; capacity: number; priceCents: number; tutorId: string; assessorId: string | null; note: string; bookOnline: boolean };

/** Put a course on, or change it. The tutor and assessor are people who work at its site. */
export function CourseDialog({ course, sites, types, staff, trigger }: {
  course?: CourseEdit; sites: Option[]; types: Option[]; staff: { siteId: string; people: Person[] }[]; trigger?: ReactNode;
}) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(course?.siteId ?? sites[0]?.id ?? "");
  const people = staff.find((s) => s.siteId === siteId)?.people ?? [];
  const fid = course ? `course-${course.id}` : "course-new";
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={trigger ?? <Button><CalendarPlus aria-hidden="true" />Put a course on</Button>}
      title={course ? "Change the course" : "Put a course on"}
      description={course ? "Its sessions and candidates stay." : "Add its sessions next, then its candidates."}
      submitLabel={course ? "Save course" : "Put it on"} successMessage={course ? "Course saved" : "Course put on"}
      submit={async (fd) => {
        const result = await saveCourse(course?.id ?? null, {
          siteId, typeId: text(fd, "typeId"), capacity: Number(fd.get("capacity") || 0), price: text(fd, "price"), tutorId: text(fd, "tutorId"), assessorId: text(fd, "assessorId"), note: text(fd, "note"),
          bookOnline: fd.get("bookOnline") === "on",
        });
        if (result.ok && !course && result.id) router.push(`/academy/${result.id}`);
        return result;
      }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Course" htmlFor={`${fid}-type`}>
          <NativeSelect id={`${fid}-type`} name="typeId" required defaultValue={course?.typeId ?? types[0]?.id ?? ""} className="min-h-11 w-full">
            {types.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Site" htmlFor={`${fid}-site`}>
          <NativeSelect id={`${fid}-site`} value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={!!course} className="min-h-11 w-full">
            {sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Tutor" htmlFor={`${fid}-tutor`}><PersonSelect id={`${fid}-tutor`} name="tutorId" people={people} defaultValue={course?.tutorId} /></Field>
        <Field label="Assessor" htmlFor={`${fid}-assessor`} optional><PersonSelect id={`${fid}-assessor`} name="assessorId" people={people} defaultValue={course?.assessorId} optional="The tutor assesses" /></Field>
        <Field label="Places" htmlFor={`${fid}-cap`}><Input id={`${fid}-cap`} name="capacity" type="number" min={1} max={100} required defaultValue={course?.capacity ?? 12} className="min-h-11" /></Field>
        <Field label="Price (€)" htmlFor={`${fid}-price`} hint="For the public. Staff may be free."><Input id={`${fid}-price`} name="price" inputMode="decimal" defaultValue={course ? pounds(course.priceCents) : ""} placeholder="350" className="min-h-11" /></Field>
      </div>
      <Field label="Note" htmlFor={`${fid}-note`} optional><Textarea id={`${fid}-note`} name="note" maxLength={500} defaultValue={course?.note} /></Field>
      <div className="flex min-h-11 items-start gap-3">
        <Checkbox id={`${fid}-online`} name="bookOnline" defaultChecked={course?.bookOnline ?? false} className="mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={`${fid}-online`}>Open for online booking</Label>
          <p className="text-xs text-ui-muted-foreground">People can hold a place on the booking site until the course starts. Reception phones them within 72 hours to take payment.</p>
        </div>
      </div>
    </FormDialog>
  );
}

export function CourseStatusButton({ id, to, label, title, description, destructive }: { id: string; to: "planned" | "completed" | "cancelled"; label: string; title: string; description: string; destructive?: boolean }) {
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
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function SessionDialog({ courseId, session, areas, suggestDate, trigger }: { courseId: string; session?: SessionEdit; areas: string[]; suggestDate?: string; trigger?: ReactNode }) {
  const refresh = useRefresh();
  const fid = session ? `s-${session.id}` : "s-new";
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={trigger ?? <Button variant="outline"><CalendarPlus aria-hidden="true" />Add a session</Button>}
      title={session ? "Change the session" : "Add a session"} description="It shows on the Rota in its area for the tutor and assessor."
      submitLabel={session ? "Save session" : "Add session"} successMessage={session ? "Session saved" : "Session added"} onSuccess={refresh}
      submit={(fd) => saveSession(courseId, session?.id ?? null, { date: text(fd, "date"), start: text(fd, "start"), end: text(fd, "end"), place: text(fd, "place"), note: text(fd, "note") })}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Day" htmlFor={`${fid}-date`}><Input id={`${fid}-date`} name="date" type="date" required defaultValue={session?.date ?? suggestDate} className="min-h-11" /></Field>
        <Field label="Starts" htmlFor={`${fid}-start`}><Input id={`${fid}-start`} name="start" type="time" step={900} required defaultValue={clock(session?.startMinutes ?? 540)} className="min-h-11" /></Field>
        <Field label="Ends" htmlFor={`${fid}-end`}><Input id={`${fid}-end`} name="end" type="time" step={900} required defaultValue={clock(session?.endMinutes ?? 1020)} className="min-h-11" /></Field>
      </div>
      <Field label="Where" htmlFor={`${fid}-place`} optional hint="The site's areas, kept in Admin."><AreaSelect id={`${fid}-place`} name="place" areas={areas} defaultValue={session?.place} /></Field>
      <Field label="Note" htmlFor={`${fid}-note`} optional><Input id={`${fid}-note`} name="note" maxLength={200} defaultValue={session?.note} placeholder="Theory and CPR" className="min-h-11" /></Field>
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

/** A session's register: the minutes each candidate was there, all of it by default. */
export function RegisterDialog({ session, candidates, trigger }: {
  session: { id: string; label: string; length: number; marks: Record<string, number>; taken: boolean };
  candidates: { id: string; name: string }[]; trigger?: ReactNode;
}) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={trigger ?? <Button variant={session.taken ? "ghost" : "outline"}><ClipboardCheck aria-hidden="true" />{session.taken ? "Change register" : "Take register"}</Button>}
      title={`Register: ${session.label}`} description={`Untick anyone who was not there. For a late arrival or early finish, change their minutes (the session is ${session.length}).`}
      submitLabel="Save register" successMessage="Register saved" onSuccess={refresh}
      submit={(fd) => takeRegister(session.id, candidates.map((c) => ({ candidateId: c.id, minutes: fd.get(`there-${c.id}`) ? Number(fd.get(`min-${c.id}`) || 0) : 0 })))}>
      {candidates.length === 0 ? <p className="text-sm">Nobody is on the course yet.</p> : (
        <ul className="pc-rows">
          {candidates.map((c) => {
            const was = session.marks[c.id];
            return (
              <li key={c.id} className="pc-row">
                <Checkbox id={`reg-${session.id}-${c.id}`} name={`there-${c.id}`} defaultChecked={session.taken ? (was ?? 0) > 0 : true} />
                <Label htmlFor={`reg-${session.id}-${c.id}`} className="pc-row-body font-normal">{c.name}</Label>
                <span className="pc-row-trail">
                  <Input aria-label={`Minutes ${c.name} was there`} name={`min-${c.id}`} type="number" min={0} max={session.length} defaultValue={was && was > 0 ? was : session.length} className="min-h-11 w-24" />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </FormDialog>
  );
}

/* ---------- Candidates ---------- */

export type CandidateEdit = { id: string; userId: string | null; name: string; email: string; phone: string; dateOfBirth: string | null; payment: string; paidCents: number; note: string };

/** Put someone on the course: one of our staff, or a member of the public. Payment is taken
 *  elsewhere and recorded here. */
export function CandidateDialog({ courseId, candidate, staff, priceCents, trigger }: { courseId: string; candidate?: CandidateEdit; staff: Person[]; priceCents: number; trigger?: ReactNode }) {
  const refresh = useRefresh();
  const [who, setWho] = useState<"staff" | "public">(candidate ? (candidate.userId ? "staff" : "public") : "public");
  const fid = candidate ? `cand-${candidate.id}` : "cand-new";
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={trigger ?? <Button><UserPlus aria-hidden="true" />Add a candidate</Button>}
      title={candidate ? `Change ${candidate.name}` : "Add a candidate"} description="Their details are kept with the course, for the tutor and the awarding body."
      submitLabel={candidate ? "Save" : "Add to course"} successMessage={candidate ? "Candidate saved" : "Candidate added"} onSuccess={refresh}
      submit={(fd) => saveCandidate(courseId, candidate?.id ?? null, {
        userId: who === "staff" ? text(fd, "userId") : "", name: text(fd, "name"), email: text(fd, "email"), phone: text(fd, "phone"), dateOfBirth: text(fd, "dateOfBirth"),
        payment: text(fd, "payment"), paid: text(fd, "paid"), note: text(fd, "note"),
      })}>
      {!candidate ? (
        <Field label="Who" htmlFor={`${fid}-who`}>
          <NativeSelect id={`${fid}-who`} value={who} onChange={(e) => setWho(e.target.value as "staff" | "public")} className="min-h-11 w-full">
            <NativeSelectOption value="public">A member of the public</NativeSelectOption>
            <NativeSelectOption value="staff">One of our staff</NativeSelectOption>
          </NativeSelect>
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {who === "staff" ? (
          <Field label="Staff member" htmlFor={`${fid}-user`}><PersonSelect id={`${fid}-user`} name="userId" people={staff} defaultValue={candidate?.userId} /></Field>
        ) : (
          <Field label="Name" htmlFor={`${fid}-name`}><Input id={`${fid}-name`} name="name" required minLength={2} maxLength={120} defaultValue={candidate?.name} className="min-h-11" /></Field>
        )}
        <Field label="Date of birth" htmlFor={`${fid}-dob`} optional={who === "staff"} hint={who === "staff" ? "From their record when left empty." : "For the minimum age."}>
          <Input id={`${fid}-dob`} name="dateOfBirth" type="date" defaultValue={candidate?.dateOfBirth ?? ""} className="min-h-11" />
        </Field>
        <Field label="Email" htmlFor={`${fid}-email`} optional><Input id={`${fid}-email`} name="email" type="email" maxLength={200} defaultValue={candidate?.email} className="min-h-11" /></Field>
        <Field label="Phone" htmlFor={`${fid}-phone`} optional><Input id={`${fid}-phone`} name="phone" type="tel" maxLength={40} defaultValue={candidate?.phone} className="min-h-11" /></Field>
        <Field label="Payment" htmlFor={`${fid}-pay`}>
          <NativeSelect id={`${fid}-pay`} name="payment" defaultValue={candidate?.payment ?? (who === "staff" ? "waived" : "owed")} key={who} className="min-h-11 w-full">
            {ACADEMY_PAYMENTS.map((p) => <NativeSelectOption key={p} value={p}>{ACADEMY_PAYMENT_META[p].label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Paid so far (€)" htmlFor={`${fid}-paid`} optional hint={priceCents ? `The course is €${pounds(priceCents)}.` : undefined}>
          <Input id={`${fid}-paid`} name="paid" inputMode="decimal" defaultValue={candidate ? pounds(candidate.paidCents) : ""} className="min-h-11" />
        </Field>
      </div>
      <Field label="Note" htmlFor={`${fid}-note`} optional><Textarea id={`${fid}-note`} name="note" maxLength={500} defaultValue={candidate?.note} /></Field>
    </FormDialog>
  );
}

export function WithdrawButton({ id, name, withdrawn }: { id: string; name: string; withdrawn: boolean }) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} destructive={!withdrawn} cancelLabel="Not now" title={withdrawn ? `Put ${name} back on?` : `Withdraw ${name}?`}
      description={withdrawn ? "They take a place again." : "Their place is freed. Their record and register marks stay."}
      trigger={<Button type="button" variant="ghost" className={withdrawn ? undefined : "text-ui-destructive"}>{withdrawn ? "Put back" : "Withdraw"}</Button>}
      submitLabel={withdrawn ? "Put back" : "Withdraw"} successMessage={withdrawn ? "Put back on" : "Withdrawn"} onSuccess={refresh} submit={() => setWithdrawn(id, !withdrawn)}>
      <p className="text-sm text-ui-muted-foreground">Any refund is handled where the payment was taken.</p>
    </FormDialog>
  );
}

export function ChecksDialog({ candidate, asks, trigger }: {
  candidate: { id: string; name: string; dateOfBirth: string | null; swimTestOn: string | null; medicalOn: string | null; idCheckedOn: string | null };
  asks: string[]; trigger?: ReactNode;
}) {
  const refresh = useRefresh();
  const fid = `chk-${candidate.id}`;
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={trigger ?? <Button type="button" variant="outline">Checks</Button>}
      title={`${candidate.name}: pre-course checks`} description="The day each was done. Leave one empty when it has not been."
      submitLabel="Save checks" successMessage="Checks saved" onSuccess={refresh}
      submit={(fd) => recordChecks(candidate.id, { dateOfBirth: text(fd, "dob"), swimTestOn: text(fd, "swim"), medicalOn: text(fd, "medical"), idCheckedOn: text(fd, "id") })}>
      <div className="grid gap-4 sm:grid-cols-2">
        {asks.includes("age") ? <Field label="Date of birth" htmlFor={`${fid}-dob`}><Input id={`${fid}-dob`} name="dob" type="date" defaultValue={candidate.dateOfBirth ?? ""} className="min-h-11" /></Field> : null}
        {asks.includes("swim") ? <Field label="Swim test passed on" htmlFor={`${fid}-swim`} optional><Input id={`${fid}-swim`} name="swim" type="date" defaultValue={candidate.swimTestOn ?? ""} className="min-h-11" /></Field> : null}
        {asks.includes("medical") ? <Field label="Medical form received on" htmlFor={`${fid}-med`} optional><Input id={`${fid}-med`} name="medical" type="date" defaultValue={candidate.medicalOn ?? ""} className="min-h-11" /></Field> : null}
        {asks.includes("id") ? <Field label="Photo ID seen on" htmlFor={`${fid}-id`} optional><Input id={`${fid}-id`} name="id" type="date" defaultValue={candidate.idCheckedOn ?? ""} className="min-h-11" /></Field> : null}
      </div>
    </FormDialog>
  );
}

export function ResultDialog({ candidate, today, grants, trigger }: {
  candidate: { id: string; name: string; status: string; resultOn: string | null; certificateNumber: string; certificateExpires: string | null; resultNote: string; isStaff: boolean };
  today: string; grants: string | null; trigger?: ReactNode;
}) {
  const refresh = useRefresh();
  const fid = `res-${candidate.id}`;
  const outcome = (ACADEMY_OUTCOMES as readonly string[]).includes(candidate.status) ? candidate.status : "passed";
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={trigger ?? <Button type="button" variant="outline">{candidate.resultOn ? "Change result" : "Record result"}</Button>}
      title={`${candidate.name}: result`}
      description={candidate.isStaff && grants ? `A pass puts ${grants} on their staff record, with the certificate number and expiry.` : "The awarding body's result and certificate."}
      submitLabel="Save result" successMessage={candidate.isStaff && grants ? `Result saved; a pass puts ${grants} on their record` : "Result saved"} onSuccess={refresh}
      submit={(fd) => recordResult(candidate.id, { status: text(fd, "status") as (typeof ACADEMY_OUTCOMES)[number], resultOn: text(fd, "resultOn"), certificateNumber: text(fd, "cert"), certificateExpires: text(fd, "expires"), note: text(fd, "note") })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Result" htmlFor={`${fid}-status`}>
          <NativeSelect id={`${fid}-status`} name="status" defaultValue={outcome} className="min-h-11 w-full">
            {ACADEMY_OUTCOMES.map((o) => <NativeSelectOption key={o} value={o}>{ACADEMY_RESULT_META[o].label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Day of the result" htmlFor={`${fid}-on`}><Input id={`${fid}-on`} name="resultOn" type="date" required defaultValue={candidate.resultOn ?? today} className="min-h-11" /></Field>
        <Field label="Certificate expires" htmlFor={`${fid}-exp`} hint="Needed for a pass."><Input id={`${fid}-exp`} name="expires" type="date" defaultValue={candidate.certificateExpires ?? ""} className="min-h-11" /></Field>
        <Field label="Certificate number" htmlFor={`${fid}-cert`} optional><Input id={`${fid}-cert`} name="cert" maxLength={80} defaultValue={candidate.certificateNumber} className="min-h-11" /></Field>
      </div>
      <Field label="Note" htmlFor={`${fid}-note`} optional><Textarea id={`${fid}-note`} name="note" maxLength={500} defaultValue={candidate.resultNote} placeholder="Referred on the spinal management module" /></Field>
    </FormDialog>
  );
}
