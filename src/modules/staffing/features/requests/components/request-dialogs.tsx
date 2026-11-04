"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { acceptSwap, decideSwap, recordExamAbsence, requestSwap } from "@/modules/staffing/features/requests/server/actions";
import { checked, PersonPicker, shiftLabel, text, THEME, useRefresh, Warnings } from "@/modules/staffing/shared/components/kit";
import { rankFits, type Candidate, type FitShift, type StaffingSettings } from "@/modules/staffing/shared/rules";

type Ahead = { id: string; date: string; startMin: number; endMin: number; role: string; name: string; userId: string; person: string; swapOpen: boolean; swappable: boolean };
type Shifts = readonly (FitShift & { userId: string })[];

/** Ask for a swap for a teacher (BR-5.2, 5.3): their shift, then a named taker or "Looking for cover". */
export function AskSwap({ ahead, people, shifts, settings }: { ahead: Ahead[]; people: readonly Candidate[]; shifts: Shifts; settings: StaffingSettings }) {
  const refresh = useRefresh();
  const open = ahead.filter((s) => s.swappable && !s.swapOpen);
  const [shiftId, setShiftId] = useState(open[0]?.id ?? "");
  const shift = open.find((s) => s.id === shiftId);
  const ranked = shift ? rankFits(shift, people.filter((p) => p.id !== shift.userId), shifts, settings) : [];
  const [taker, setTaker] = useState("");
  const chosen = ranked.find((p) => p.id === taker);
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg" trigger={<Button disabled={open.length === 0}><Plus aria-hidden="true" />Ask for a swap</Button>}
      title="Ask for a swap" description={`For a teacher who asked. Swaps close ${settings.swapNoticeHours} hours before the shift; after that they phone the duty manager.`}
      submitLabel="Ask" successMessage="Swap asked for" onSuccess={refresh}
      submit={(fd) => requestSwap(text(fd, "shiftId"), { takerId: text(fd, "takerId") || null, takerAgreed: checked(fd, "agreed") })}>
      <Field label="Shift" htmlFor="stf-swap-shift">
        <NativeSelect id="stf-swap-shift" name="shiftId" value={shiftId} onChange={(e) => { setShiftId(e.target.value); setTaker(""); }} className="min-h-11 w-full">
          {open.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.person}: {shiftLabel(s)}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Taken by" htmlFor="stf-swap-taker" hint="Best fit first. Leave it as Looking for cover if nobody has offered yet.">
        <NativeSelect id="stf-swap-taker" name="takerId" value={taker} onChange={(e) => setTaker(e.target.value)} className="min-h-11 w-full">
          <NativeSelectOption value="">Looking for cover</NativeSelectOption>
          {ranked.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.name}{p.warnings.length ? ` (${p.warnings.length} warning${p.warnings.length === 1 ? "" : "s"})` : ""}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      {chosen ? <Warnings warnings={chosen.warnings} /> : null}
      {taker ? <Label className="flex min-h-11 items-center gap-3"><Checkbox name="agreed" defaultChecked />They have agreed to take it</Label> : null}
    </FormDialog>
  );
}

/** Someone takes an open swap. */
export function AcceptSwap({ swapId, shift, requesterId, people, shifts, settings }: { swapId: string; shift: FitShift & { name: string }; requesterId: string; people: readonly Candidate[]; shifts: Shifts; settings: StaffingSettings }) {
  return (
    <PersonPicker shift={shift} people={people} shifts={shifts} settings={settings} exclude={[requesterId]}
      trigger={<Button variant="outline">Someone takes it</Button>} title="Who takes it?" submitLabel="They take it" successMessage="Swap taken"
      act={(userId) => (userId ? acceptSwap(swapId, userId) : Promise.resolve({ ok: false as const, error: "Choose who takes it." }))} />
  );
}

/** Approve or refuse (BR-5.3): within 24 hours of it being taken. */
export function DecideSwap({ swapId, summary, warnings, overLimit }: { swapId: string; summary: string; warnings: string[]; overLimit: boolean }) {
  const refresh = useRefresh();
  const [approve, setApprove] = useState("approve");
  return (
    <FormDialog portalClassName={THEME} trigger={<Button>Decide</Button>} title="Approve this swap?" description={summary}
      submitLabel={approve === "approve" ? "Approve" : "Refuse"} destructive={approve !== "approve"} successMessage="Swap decided" onSuccess={refresh}
      submit={(fd) => decideSwap(swapId, { approve: approve === "approve", reason: text(fd, "reason") })}>
      {warnings.length ? <ul className="text-sm">{warnings.map((w) => <li key={w}>{w}</li>)}</ul> : <p className="text-sm text-ui-muted-foreground">No warnings for the person taking it.</p>}
      {overLimit ? <p className="text-sm">They have asked to give away more shifts in this block than the limit.</p> : null}
      <SegmentedChoice aria-label="Decision" value={approve} onValueChange={setApprove} options={[{ value: "approve", label: "Approve" }, { value: "refuse", label: "Refuse" }]} />
      {approve === "refuse" ? <Field label="Why" htmlFor={`stf-refuse-${swapId}`}><Textarea id={`stf-refuse-${swapId}`} name="reason" required minLength={3} maxLength={300} /></Field> : null}
    </FormDialog>
  );
}

/** Record an exam absence with the college's notice (BR-7.3, 7.4). */
export function RecordExam({ ahead, today, nowTime }: { ahead: Ahead[]; today: string; nowTime: string }) {
  const refresh = useRefresh();
  const [notice, setNotice] = useState(true);
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg" trigger={<Button variant="outline" disabled={ahead.length === 0}><Plus aria-hidden="true" />Exam absence</Button>}
      title="Record an exam absence" description="The outcome follows from the college's exam season, when they asked and the date on the college's notice."
      submitLabel="Record" successMessage="Exam absence recorded" onSuccess={refresh}
      submit={(fd) => recordExamAbsence(text(fd, "shiftId"), { requestedOn: text(fd, "requestedOn"), requestedTime: text(fd, "requestedTime"), noticeSentOn: notice ? text(fd, "noticeSentOn") || null : null, note: text(fd, "note") })}>
      <Field label="Shift" htmlFor="stf-exam-shift">
        <NativeSelect id="stf-exam-shift" name="shiftId" className="min-h-11 w-full">
          {ahead.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.person}: {shiftLabel(s)}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Day they asked" htmlFor="stf-exam-on"><Input id="stf-exam-on" name="requestedOn" type="date" required defaultValue={today} max={today} className="min-h-11" /></Field>
        <Field label="Time they asked" htmlFor="stf-exam-at"><Input id="stf-exam-at" name="requestedTime" type="time" required defaultValue={nowTime} className="min-h-11" /></Field>
      </div>
      <Label className="flex min-h-11 items-center gap-3"><Checkbox checked={notice} onCheckedChange={(v) => setNotice(v === true)} />They gave the college&apos;s exam notice</Label>
      {notice ? (
        <Field label="Date the college sent the notice" htmlFor="stf-exam-sent" hint="From the notice itself.">
          <Input id="stf-exam-sent" name="noticeSentOn" type="date" required max={today} className="min-h-11" />
        </Field>
      ) : <p className="text-sm">Without the college&apos;s notice the absence is refused and referred as possible serious misconduct.</p>}
      <Field label="Note" htmlFor="stf-exam-note" optional><Textarea id="stf-exam-note" name="note" maxLength={500} /></Field>
    </FormDialog>
  );
}
