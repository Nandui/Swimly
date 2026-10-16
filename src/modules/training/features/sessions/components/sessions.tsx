"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Check, ClipboardCheck, Pencil, Plus, RotateCcw, UserMinus, UserPlus, X } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field, FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { today } from "@/lib/format";
import { addToSession, cancelSession, closeRegister, markPlace, removeFromSession, saveSession } from "@/modules/training/features/sessions/server/actions";
import { THEME } from "@/modules/training/shared/components/dialog-kit";
import { PeopleChooser, type ChoosablePerson } from "@/modules/training/shared/components/people-chooser";

/** Classroom and poolside sessions (e-learning phase 5): planning one,
 *  booking people on, taking the register and closing it. */

type Option = { id: string; title?: string; name?: string };
type Existing = { id: string; title: string; courseId: string | null; siteId: string | null; location: string; date: string; start: string; minutes: number; capacity: number | null; trainerName: string; hoursTypeId: string | null; note: string };

const pick = (formData: FormData, name: string) => { const v = String(formData.get(name) ?? ""); return v || null; };

export function SessionDialog({ session, courses, sites, types }: { session?: Existing; courses: Option[]; sites: Option[]; types: Option[] }) {
  const router = useRouter();
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-2xl"
      trigger={session
        ? <Button variant="outline" className="min-h-11"><Pencil aria-hidden="true" />Change</Button>
        : <Button className="min-h-11"><Plus aria-hidden="true" />Plan a session</Button>}
      title={session ? `Change ${session.title}` : "Plan a session"}
      description="A classroom or poolside session people are booked on. Closing its register gives everyone who came the hours and, when it teaches a course, that course completed."
      submitLabel={session ? "Save session" : "Plan session"}
      successMessage={session ? "Session saved" : "Session planned"}
      onSuccess={() => router.refresh()}
      submit={async (formData) => {
        const capacity = String(formData.get("capacity") ?? "");
        const result = await saveSession(session?.id ?? null, {
          title: String(formData.get("title") ?? ""), courseId: pick(formData, "courseId"), siteId: pick(formData, "siteId"),
          location: String(formData.get("location") ?? ""), date: String(formData.get("date") ?? ""), start: String(formData.get("start") ?? ""),
          minutes: Number(formData.get("minutes") ?? 0), capacity: capacity ? Number(capacity) : null, trainerName: String(formData.get("trainerName") ?? ""),
          hoursTypeId: pick(formData, "hoursTypeId"), note: String(formData.get("note") ?? ""),
        });
        if (result.ok && !session) router.push(`/training/sessions/${result.id}`);
        return result.ok ? { ok: true } : result;
      }}
    >
      <Input id="session-title" name="title" label="Name" required maxLength={120} defaultValue={session?.title} placeholder="Spinal injury management, in-service" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input id="session-date" name="date" label="Date" type="date" required defaultValue={session?.date ?? today()} />
        <Input id="session-start" name="start" label="Starts" type="time" required defaultValue={session?.start ?? "18:00"} />
        <Input id="session-minutes" name="minutes" label="Minutes" type="number" inputMode="numeric" min={5} max={1440} step={5} required defaultValue={String(session?.minutes ?? 60)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Site" htmlFor="session-site" optional>
          <NativeSelect id="session-site" name="siteId" defaultValue={session?.siteId ?? ""} className="min-h-11 w-full">
            <NativeSelectOption value="">No site</NativeSelectOption>
            {sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Input id="session-location" name="location" label="Room or place" optional maxLength={120} defaultValue={session?.location} placeholder="Main pool, lanes 1 to 3" />
        <Input id="session-trainer" name="trainerName" label="Trainer" optional maxLength={120} defaultValue={session?.trainerName} />
        <Input id="session-capacity" name="capacity" label="Places" type="number" inputMode="numeric" min={1} max={500} defaultValue={session?.capacity ? String(session.capacity) : ""} optional description="Leave empty for no limit." />
      </div>
      <Field label="Course it completes" htmlFor="session-course" optional hint="Everyone marked as attended has this course completed and gets its qualification.">
        <NativeSelect id="session-course" name="courseId" defaultValue={session?.courseId ?? ""} className="min-h-11 w-full">
          <NativeSelectOption value="">None</NativeSelectOption>
          {courses.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.title}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Counts towards hours for" htmlFor="session-type" optional hint="For in-service hours, such as the 20 hours a lifeguard needs each year.">
        <NativeSelect id="session-type" name="hoursTypeId" defaultValue={session?.hoursTypeId ?? ""} className="min-h-11 w-full">
          <NativeSelectOption value="">General training hours</NativeSelectOption>
          {types.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Note for people booked" htmlFor="session-note" optional>
        <Textarea id="session-note" name="note" rows={2} maxLength={1000} defaultValue={session?.note} placeholder="Bring swimwear and a towel." />
      </Field>
    </FormDialog>
  );
}

export function CancelSession({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11"><Ban aria-hidden="true" />Cancel session</Button>}
      title={`Cancel ${title}?`}
      description="Nobody gets hours or the course for it. The bookings stay on record."
      submitLabel="Cancel session"
      cancelLabel="Keep it"
      destructive
      successMessage="Session cancelled"
      onSuccess={() => router.refresh()}
      submit={(formData) => cancelSession(id, String(formData.get("reason") ?? ""))}
    >
      <Field label="Why" htmlFor="cancel-reason">
        <Textarea id="cancel-reason" name="reason" rows={2} required minLength={3} maxLength={300} />
      </Field>
    </FormDialog>
  );
}

export function AddToSession({ id, title, people, left }: { id: string; title: string; people: ChoosablePerson[]; left: number | null }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      trigger={<Button className="min-h-11" disabled={left === 0}><UserPlus aria-hidden="true" />{left === 0 ? "Full" : "Book people"}</Button>}
      title={`Book people on ${title}`}
      description={left === null ? "They see it in Turnfin Me." : `${left} ${left === 1 ? "place" : "places"} left. They see it in Turnfin Me.`}
      submitLabel="Book"
      successMessage="Booked"
      onOpen={() => setChosen(new Set())}
      onSuccess={() => router.refresh()}
      submit={async () => {
        const result = await addToSession(id, [...chosen]);
        if (result.ok) toast.success(`${result.added} booked.`);
        return result.ok ? { ok: true } : result;
      }}
    >
      <PeopleChooser idPrefix="book" people={people} chosen={chosen} onChange={setChosen} />
    </FormDialog>
  );
}

export function RemoveFromSession({ placeId, name }: { placeId: string; name: string }) {
  return (
    <ConfirmAction
      trigger={<Button variant="ghost" className="min-h-11" aria-label={`Take ${name} off`}><UserMinus aria-hidden="true" /><span className="pc-only-wide">Take off</span></Button>}
      title={`Take ${name} off this session?`}
      description="Their place is freed for someone else."
      confirmLabel="Take off"
      destructive
      successMessage="Taken off"
      run={() => removeFromSession(placeId)}
    />
  );
}

/** One person's line on the register: Attended or Absent, tablet-sized. */
export function RegisterToggle({ placeId, name, status }: { placeId: string; name: string; status: "BOOKED" | "ATTENDED" | "ABSENT" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (next: "BOOKED" | "ATTENDED" | "ABSENT") => start(async () => {
    const result = await markPlace(placeId, next);
    if (!result.ok) { toast.error(result.error); return; }
    router.refresh();
  });
  return (
    <div className="flex gap-2" role="group" aria-label={`${name}: attendance`}>
      <Button type="button" variant={status === "ATTENDED" ? "default" : "outline"} aria-pressed={status === "ATTENDED"} className="min-h-12" disabled={pending}
        onClick={() => set(status === "ATTENDED" ? "BOOKED" : "ATTENDED")}><Check aria-hidden="true" />Attended</Button>
      <Button type="button" variant={status === "ABSENT" ? "destructive" : "outline"} aria-pressed={status === "ABSENT"} className="min-h-12" disabled={pending}
        onClick={() => set(status === "ABSENT" ? "BOOKED" : "ABSENT")}><X aria-hidden="true" />Absent</Button>
    </div>
  );
}

export function MarkEveryoneAttended({ placeIds }: { placeIds: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!placeIds.length) return null;
  return (
    <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => start(async () => {
      for (const id of placeIds) {
        const result = await markPlace(id, "ATTENDED");
        if (!result.ok) { toast.error(result.error); break; }
      }
      router.refresh();
    })}><RotateCcw aria-hidden="true" />Mark the rest attended</Button>
  );
}

export function CloseRegister({ id, title, attended, absent, course }: { id: string; title: string; attended: number; absent: number; course: string | null }) {
  return (
    <ConfirmAction
      trigger={<Button className="min-h-11"><ClipboardCheck aria-hidden="true" />Close the register</Button>}
      title={`Close the register of ${title}?`}
      description={`${attended} attended and ${absent} absent. Everyone who attended gets the hours${course ? ` and ${course} completed` : ""}. The register can't change after this.`}
      confirmLabel="Close register"
      successMessage="Register closed"
      run={async () => { const result = await closeRegister(id); return result.ok ? { ok: true } : result; }}
    />
  );
}
