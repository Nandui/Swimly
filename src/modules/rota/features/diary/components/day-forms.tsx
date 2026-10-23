"use client";

import { useState } from "react";
import { CalendarPlus, Copy, GraduationCap, Send, UserPlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { FormDialog } from "@/components/form-dialog";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { SearchablePicker } from "@/components/searchable-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { carryTeachers, copyPlan, saveNeed, shareWeek } from "@/modules/rota/shared/actions";
import { ChangeFields, changeOf } from "@/modules/rota/shared/components/change-fields";
import { saveShift } from "@/modules/rota/features/diary/server/actions";
import { useDiary } from "@/modules/rota/features/diary/components/context";
import { addDaysIso } from "@/modules/rota/shared/constants";

const PORTAL = "turnfin-module";
const s = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Bring someone into the day before anything is given to them: a shift on its own. */
export function AddSomeone() {
  const ctx = useDiary();
  const off = new Set(ctx.pool.off);
  const on = new Set(ctx.diary.people.map((p) => p.userId));
  const options = [...ctx.pool.staff].filter((x) => !on.has(x.userId)).sort((a, b) => a.name.localeCompare(b.name))
    .map((x) => ({ value: x.userId, label: x.name, hint: off.has(x.userId) ? "Off today" : x.departmentIds.map((d) => ctx.departmentNames[d]).filter(Boolean).join(", ") || undefined }));
  return (
    <FormDialog portalClassName={PORTAL} title="Add someone to the day" description={`They are in for these times on ${ctx.dateLabel}. Give them things to do from their day.`}
      submitLabel="Add" successMessage="Added to the day." trigger={<Button variant="outline"><UserPlus aria-hidden="true" />Add someone</Button>}
      submit={(f) => saveShift(null, { siteId: ctx.siteId, departmentId: ctx.departmentFor ?? "", date: ctx.date, userId: s(f, "userId"), start: s(f, "start"), end: s(f, "end") }, ctx.live ? changeOf(f) : {})}>
      <SearchablePicker name="userId" label="Who" options={options} placeholder="Choose someone" searchPlaceholder="Search by name" emptyText="Nobody by that name." />
      <div className="diary-times">
        <Input type="time" name="start" label="From" step={300} defaultValue="09:00" required />
        <Input type="time" name="end" label="To" step={300} defaultValue="17:00" required />
      </div>
      {ctx.live ? <ChangeFields id="diary-add-someone" /> : null}
    </FormDialog>
  );
}

/** Something more on the day that needs people: an activity in an area, for a time. */
export function AddToDay() {
  const ctx = useDiary();
  if (!ctx.types.length) return null;
  return (
    <FormDialog portalClassName={PORTAL} title="Add to the day" description={`Something on ${ctx.dateLabel} that needs people. It shows under Not covered yet until someone is on it.`}
      submitLabel="Add" successMessage="Added to the day." width="sm:max-w-lg" trigger={<Button variant="outline"><CalendarPlus aria-hidden="true" />Add to the day</Button>}
      submit={(f) => saveNeed(null, { siteId: ctx.siteId, date: ctx.date, typeId: s(f, "typeId"), place: s(f, "place"), start: s(f, "start"), end: s(f, "end"),
        places: Number(s(f, "places")), note: s(f, "note"), lanes: [] }, ctx.live ? changeOf(f) : {})}>
      <Select name="typeId" label="What" required placeholder="Choose the activity" options={ctx.types.map((t) => ({ value: t.id, label: t.name }))} />
      <Select name="place" label="Where" optional placeholder="Choose an area" options={[{ value: "", label: "No area" }, ...ctx.areas.map((a) => ({ value: a.name, label: a.parentName ? `${a.parentName} › ${a.name}` : a.name }))]} />
      <div className="diary-times">
        <Input type="time" name="start" label="From" step={300} defaultValue="10:00" required />
        <Input type="time" name="end" label="To" step={300} defaultValue="11:00" required />
      </div>
      <Input type="number" name="places" label="How many staff" min={1} max={20} defaultValue={1} required />
      <Textarea name="note" label="Note" optional maxLength={300} />
      {ctx.live ? <ChangeFields id="diary-add-need" /> : null}
    </FormDialog>
  );
}

/** Copy an earlier day or week of this department onto this one, when nothing is planned there yet. */
export function CopyWeek({ siteId, departmentId, date, monday, days, weeks }: {
  siteId: string; departmentId: string; date: string; monday: string;
  days: { iso: string; label: string }[]; weeks: { iso: string; label: string }[];
}) {
  const [what, setWhat] = useState<"1" | "7">("1");
  const options = what === "1" ? days : weeks;
  return (
    <FormDialog portalClassName={PORTAL} title="Copy an earlier plan" description="It fills only days with nothing of this department on them, so nothing planned is overwritten."
      submitLabel="Copy" successMessage="Copied." trigger={<Button variant="outline"><Copy aria-hidden="true" />Copy</Button>}
      onClose={() => setWhat("1")}
      submit={(f) => copyPlan({ siteId, departmentId, from: s(f, "from"), to: what === "1" ? date : monday, days: what === "1" ? 1 : 7, people: f.get("people") === "on" })}>
      <SegmentedChoice aria-label="What to copy" value={what} onValueChange={(v) => setWhat(v as "1" | "7")} options={[{ value: "1", label: "A day onto this day" }, { value: "7", label: "A week onto this week" }]} />
      <Select key={what} name="from" label="Copy from" required defaultValue={options[0]?.iso} options={options.map((o) => ({ value: o.iso, label: o.label }))} />
      <Switch name="people" label="With who was on each" defaultChecked />
    </FormDialog>
  );
}

/** Share the department's week with its staff: they see it in Turnfin Me and are told once. */
export function ShareWeekDialog({ siteId, departmentId, monday, department, holes }: { siteId: string; departmentId: string; monday: string; department: string; holes: number }) {
  return (
    <FormDialog portalClassName={PORTAL} title={`Share ${department}'s week?`} submitLabel="Share the week" successMessage="Shared with staff."
      description={`${department} staff see their days in Turnfin Me and are told once. ${holes ? `${holes} things are still not covered this week; you can keep filling after sharing.` : "Everything is covered."}`}
      trigger={<Button><Send aria-hidden="true" />Share with staff</Button>}
      submit={() => shareWeek({ siteId, departmentId, monday })}>
      <p className="diary-muted">Changes after sharing tell the people they affect.</p>
    </FormDialog>
  );
}

/** Carry the swim school's instructors over onto the Plan (owner, 23 October 2026: instructors are
 *  chosen on the rota from now on, and nothing is lost). Only classes nobody is chosen for yet. */
export function CarryTeachers({ siteId, departmentId, from, until }: { siteId: string; departmentId: string; from: string; until: string }) {
  return (
    <FormDialog portalClassName={PORTAL} title="Carry the instructors over" submitLabel="Carry them over" successMessage="The instructors are on the Plan."
      description="Each swim class keeps the instructor it has now, on every week up to the day you choose. Classes already chosen on the Plan stay as they are, and you can change any day after."
      trigger={<Button variant="outline"><GraduationCap aria-hidden="true" />Carry the instructors over</Button>}
      submit={(f) => carryTeachers({ siteId, departmentId, until: s(f, "until") })}>
      <Input type="date" name="until" label="Up to" defaultValue={until} min={from} max={addDaysIso(from, 112)} required description="Up to sixteen weeks ahead." />
    </FormDialog>
  );
}
