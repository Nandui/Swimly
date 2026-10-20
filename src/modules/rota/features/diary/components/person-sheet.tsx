"use client";

import { useState } from "react";
import { Clock, Coffee, Flag, ListChecks, Moon, Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Label } from "@/components/shadcn/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { FormDialog } from "@/components/form-dialog";
import { Notice } from "@/components/ui-kit/notice";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { breakEntitlement, clock } from "@/modules/rota/shared/constants";
import { ChangeFields, changeOf } from "@/modules/rota/shared/components/change-fields";
import { stepsOf, type Line, type PersonDay, type Span, type Step } from "@/modules/rota/features/diary/model";
import { changeLine, fillNeed, placeBreaks, removeLine, removeShift, saveLineSubs, saveShift } from "@/modules/rota/features/diary/server/actions";
import { useDiary } from "@/modules/rota/features/diary/components/context";
import { firstName, hoursWords, lineTitle, lineWhere, needWords, partsWords, span as spanWords, toneOf, warningWords } from "@/modules/rota/features/diary/components/words";

const PORTAL = "turnfin-module";
const s = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Someone's day as a list, top to bottom, with everything that changes it: their times on each
 *  thing, taking them off, giving them free time, their breaks and their shifts. */
export function PersonSheet({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { diary } = useDiary();
  const person = userId ? diary.people.find((p) => p.userId === userId) ?? null : null;
  return (
    <Sheet open={!!person} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent portalClassName={PORTAL} className="diary-sheet">
        {person ? <PersonBody person={person} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function PersonBody({ person }: { person: PersonDay }) {
  const ctx = useDiary();
  const young = ctx.pool.staff.find((x) => x.userId === person.userId)?.young ?? null;
  const steps = stepsOf(person);
  return (
    <>
      <SheetHeader>
        <SheetTitle>{person.name}</SheetTitle>
        <SheetDescription>{ctx.dateLabel}: {partsWords(person)}{person.parts.length ? `, ${hoursWords(person.paidMinutes)}` : ""}</SheetDescription>
      </SheetHeader>
      <div className="diary-sheet-body">
        {person.warnings.length ? (
          <Notice tone="warning" title="To look at">
            <ul className="diary-warnings">{person.warnings.map((w, i) => <li key={i}>{warningWords(w, young)}</li>)}</ul>
          </Notice>
        ) : null}
        <section aria-labelledby="diary-their-day">
          <h3 id="diary-their-day" className="diary-group-title">Their day</h3>
          {steps.length ? (
            <ol className="diary-steps">
              {steps.map((step, i) => <StepItem key={i} person={person} step={step} />)}
            </ol>
          ) : <p className="diary-muted">Nothing on this day yet.</p>}
        </section>
        {person.parts.length ? <Breaks person={person} young={young} /> : null}
        <Shifts person={person} />
      </div>
    </>
  );
}

function StepItem({ person, step }: { person: PersonDay; step: Step }) {
  const ctx = useDiary();
  if (step.kind === "work") {
    const l = step.line;
    const lines = step.count > 1 ? person.lines.filter((x) => x.kind === "class" && x.area === l.area && x.start >= step.start && x.end <= step.end) : [l];
    return (
      <li className="diary-step" data-tone={toneOf(l.kind)}>
        <span className="diary-step-time tabular-nums">{spanWords(step)}</span>
        <div className="diary-step-text">
          <span className="diary-step-title">{step.count > 1 ? `${step.count} swim classes` : lineTitle(l)}</span>
          <span className="diary-muted">{step.count > 1 ? lines.map((x) => x.title).join(", ") : lineWhere(l)}</span>
          {l.subs.length ? <ul className="diary-subs-list" aria-label="Sub-activities">{l.subs.map((x, i) => <li key={i}><span className="tabular-nums">{x.at !== null ? clock(x.at) : "Any time"}</span>{x.name}</li>)}</ul> : null}
          {ctx.canChange && ctx.departmentFor ? (
            <div className="diary-step-actions">
              {l.kind !== "class" && l.assignmentId ? <ChangeTime person={person} line={l} /> : null}
              {(l.kind === "activity" || l.kind === "booking") && l.assignmentId && (l.subs.length || (ctx.needs.get(l.needKey)?.typeId && ctx.subActivities[ctx.needs.get(l.needKey)!.typeId!]?.length)) ? <SubsDialog person={person} line={l} /> : null}
              <TakeOff person={person} lines={lines} />
            </div>
          ) : null}
        </div>
      </li>
    );
  }
  if (step.kind === "break") {
    return <li className="diary-step" data-tone="break"><span className="diary-step-time tabular-nums">{spanWords(step)}</span><span className="diary-step-title"><Coffee aria-hidden="true" />Break, {step.end - step.start} min {step.paid ? "paid" : "unpaid"}</span></li>;
  }
  if (step.kind === "free") return <FreeStep person={person} free={step} />;
  if (step.kind === "off") {
    return <li className="diary-step" data-tone="off"><span className="diary-step-time tabular-nums">{spanWords(step)}</span><span className="diary-step-title"><Moon aria-hidden="true" />Off between</span></li>;
  }
  return <li className="diary-step" data-tone="finish"><span className="diary-step-time tabular-nums">{clock(step.start)}</span><span className="diary-step-title"><Flag aria-hidden="true" />Finishes</span></li>;
}

/** Time in their shift with nothing given yet, and what still needs someone then. */
function FreeStep({ person, free }: { person: PersonDay; free: Span }) {
  const ctx = useDiary();
  const could = ctx.diary.holes.filter((h) => h.start < free.end && free.start < h.end).slice(0, 4);
  return (
    <li className="diary-step" data-tone="free">
      <span className="diary-step-time tabular-nums">{spanWords(free)}</span>
      <div className="diary-step-text">
        <span className="diary-step-title"><Clock aria-hidden="true" />Nothing given yet</span>
        {ctx.canChange && ctx.departmentFor && could.length ? (
          <div className="diary-step-actions">
            {could.map((h) => {
              const need = ctx.needs.get(h.needKey);
              if (!need) return null;
              const part = need.kind === "class" ? { start: need.start, end: need.end } : { start: Math.max(h.start, free.start), end: Math.min(h.end, free.end) };
              if (need.kind === "class" && (need.start < free.start || need.end > free.end)) return null;
              return (
                <FormDialog key={h.key} portalClassName={PORTAL} title={`Put ${firstName(person.name)} on ${need.title}`} description={`${needWords(need)}, ${spanWords(part)}.`}
                  submitLabel="Put on" successMessage={`${person.name} is on ${need.title}.`}
                  trigger={<Button variant="outline"><Plus aria-hidden="true" />{need.kind === "area" ? need.area || need.title : need.title} {spanWords(part)}</Button>}
                  submit={(f) => fillNeed({ siteId: ctx.siteId, date: ctx.date, departmentId: ctx.departmentFor!, kind: need.kind, needId: need.needId, classRef: need.classRef,
                    userId: person.userId, start: clock(part.start), end: clock(part.end) }, ctx.live ? changeOf(f) : {})}>
                  {ctx.live ? <ChangeFields id={`diary-free-${h.key}`} /> : <p className="diary-muted">It is not covered then: {h.why.toLowerCase()}.</p>}
                </FormDialog>
              );
            })}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function ChangeTime({ person, line }: { person: PersonDay; line: Line }) {
  const ctx = useDiary();
  const need = ctx.needs.get(line.needKey);
  return (
    <FormDialog portalClassName={PORTAL} title={`${firstName(person.name)} on ${lineTitle(line)}`} description={need ? `It runs ${spanWords(need)}.` : undefined}
      submitLabel="Save times" successMessage="Times changed."
      trigger={<Button variant="outline">Change time</Button>}
      submit={(f) => changeLine({ siteId: ctx.siteId, date: ctx.date, departmentId: ctx.departmentFor!, kind: line.kind, id: line.assignmentId!, userId: person.userId,
        start: s(f, "start"), end: s(f, "end") }, ctx.live ? changeOf(f) : {})}>
      <div className="diary-times">
        <Input type="time" name="start" label="From" step={300} defaultValue={clock(line.start)} required />
        <Input type="time" name="end" label="To" step={300} defaultValue={clock(line.end)} required />
      </div>
      {ctx.live ? <ChangeFields id={`diary-time-${line.key}`} /> : null}
    </FormDialog>
  );
}

function TakeOff({ person, lines }: { person: PersonDay; lines: Line[] }) {
  const ctx = useDiary();
  const what = lines.length > 1 ? `${lines.length} swim classes` : lineTitle(lines[0]);
  return (
    <FormDialog portalClassName={PORTAL} destructive title={`Take ${firstName(person.name)} off ${what}?`} description="That time will need someone again." cancelLabel="Keep them on"
      submitLabel="Take off" successMessage={`${person.name} is off ${what}.`}
      trigger={<Button variant="ghost">Take off</Button>}
      submit={async (f) => {
        const change = ctx.live ? changeOf(f) : {};
        for (const l of lines) {
          const id = l.kind === "class" ? ctx.needs.get(l.needKey)?.classRef : l.assignmentId;
          if (!id) continue;
          const result = await removeLine({ siteId: ctx.siteId, date: ctx.date, departmentId: ctx.departmentFor!, kind: l.kind, id, userId: person.userId }, change);
          if (!result.ok) return result;
        }
        return { ok: true };
      }}>
      {ctx.live ? <ChangeFields id={`diary-off-${lines[0].key}`} /> : null}
    </FormDialog>
  );
}

/** Their breaks: owed by the house rule for each stretch they work, placed by whoever plans. */
function Breaks({ person, young }: { person: PersonDay; young: Parameters<typeof breakEntitlement>[1] }) {
  const ctx = useDiary();
  const owed = person.parts.flatMap((part) => {
    const list = breakEntitlement(part.end - part.start, young);
    // Spread evenly through the stretch, on the quarter hour, unless placed already.
    return list.map((b, i) => ({ ...b, suggested: Math.round((part.start + ((i + 1) * (part.end - part.start)) / (list.length + 1)) / 15) * 15 }));
  });
  const rows = owed.map((b, i) => {
    const placed = person.breaks.filter((x) => x.placed)[i];
    return { minutes: placed ? placed.end - placed.start : b.minutes, paid: placed ? placed.paid : b.paid, start: placed ? placed.start : b.suggested };
  });
  for (const extra of person.breaks.filter((x) => x.placed).slice(owed.length)) rows.push({ minutes: extra.end - extra.start, paid: extra.paid, start: extra.start });
  const placed = person.breaks.filter((b) => b.placed);
  return (
    <section aria-labelledby="diary-breaks" className="diary-group">
      <h3 id="diary-breaks" className="diary-group-title">Breaks</h3>
      <p className="diary-muted">
        {placed.length ? placed.map((b) => `${b.end - b.start} min ${b.paid ? "paid" : "unpaid"} at ${clock(b.start)}`).join(", ") : owed.length ? "Not placed yet." : "None owed for this day."}
      </p>
      {ctx.canChange && ctx.departmentFor && rows.length ? (
        <FormDialog portalClassName={PORTAL} title={`${firstName(person.name)}'s breaks`} description={`Owed for ${partsWords(person)}: ${owed.map((b) => `${b.minutes} min ${b.paid ? "paid" : "unpaid"}`).join(", ") || "none"}. Leave a time empty to skip that break.`}
          submitLabel="Save breaks" successMessage="Breaks placed." width="sm:max-w-lg"
          trigger={<Button variant="outline"><Coffee aria-hidden="true" />{placed.length ? "Move breaks" : "Place breaks"}</Button>}
          submit={(f) => placeBreaks({ siteId: ctx.siteId, departmentId: ctx.departmentFor!, date: ctx.date, userId: person.userId,
            breaks: rows.map((_, i) => ({ start: s(f, `b${i}-start`), minutes: Number(s(f, `b${i}-minutes`)), paid: s(f, `b${i}-paid`) === "paid" })).filter((b) => b.start) }, ctx.live ? changeOf(f) : {})}>
          {rows.map((b, i) => (
            <fieldset key={i} className="diary-break-row">
              <legend className="diary-label">Break {i + 1}</legend>
              <Input type="time" name={`b${i}-start`} label="At" step={300} defaultValue={clock(b.start)} />
              <Input type="number" name={`b${i}-minutes`} label="Minutes" min={5} max={120} step={5} defaultValue={b.minutes} required />
              <Select name={`b${i}-paid`} label="Pay" defaultValue={b.paid ? "paid" : "unpaid"} options={[{ value: "paid", label: "Paid" }, { value: "unpaid", label: "Unpaid" }]} />
            </fieldset>
          ))}
          {ctx.live ? <ChangeFields id={`diary-breaks-${person.userId}`} /> : null}
        </FormDialog>
      ) : null}
    </section>
  );
}

/** Shifts planned on their own (before anything is given, or to hold a longer day). */
function Shifts({ person }: { person: PersonDay }) {
  const ctx = useDiary();
  if (!person.shifts.length && !(ctx.canChange && ctx.departmentFor)) return null;
  return (
    <section aria-labelledby="diary-shifts" className="diary-group">
      <h3 id="diary-shifts" className="diary-group-title">Shifts</h3>
      <p className="diary-muted">Their day follows what they are on; a shift holds time before anything is given.</p>
      {person.shifts.length ? (
        <ul className="diary-picks">
          {person.shifts.map((x) => (
            <li key={x.id} className="diary-pick">
              <div className="diary-pick-text"><span className="diary-pick-name tabular-nums">{spanWords(x)}</span><span className="diary-muted">{ctx.departmentNames[x.departmentId] ?? "Another department"}</span></div>
              {ctx.canChange ? (
                <div className="diary-step-actions">
                  <ShiftDialog person={person} shift={x} />
                  <FormDialog portalClassName={PORTAL} destructive title={`Take this shift off?`} description={`${person.name}, ${spanWords(x)}. What they are on stays.`} submitLabel="Take off" cancelLabel="Keep it"
                    successMessage="Shift taken off." trigger={<Button variant="ghost">Take off</Button>}
                    submit={(f) => removeShift(x.id, ctx.siteId, ctx.live ? changeOf(f) : {})}>
                    {ctx.live ? <ChangeFields id={`diary-shift-off-${x.id}`} /> : null}
                  </FormDialog>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {ctx.canChange && ctx.departmentFor ? <ShiftDialog person={person} shift={null} /> : null}
    </section>
  );
}

function ShiftDialog({ person, shift }: { person: PersonDay; shift: (Span & { id: string }) | null }) {
  const ctx = useDiary();
  const around = shift ?? (person.parts.length ? { start: person.parts[0].start, end: person.parts[person.parts.length - 1].end } : { start: 9 * 60, end: 17 * 60 });
  return (
    <FormDialog portalClassName={PORTAL} title={shift ? `Change ${firstName(person.name)}'s shift` : `A shift for ${firstName(person.name)}`} submitLabel="Save shift"
      successMessage="Shift saved." trigger={<Button variant="outline">{shift ? "Change" : <><Plus aria-hidden="true" />Add a shift</>}</Button>}
      submit={(f) => saveShift(shift?.id ?? null, { siteId: ctx.siteId, departmentId: ctx.departmentFor ?? "", date: ctx.date, userId: person.userId, start: s(f, "start"), end: s(f, "end") }, ctx.live ? changeOf(f) : {})}>
      <div className="diary-times">
        <Input type="time" name="start" label="From" step={300} defaultValue={clock(around.start)} required />
        <Input type="time" name="end" label="To" step={300} defaultValue={clock(around.end)} required />
      </div>
      {ctx.live ? <ChangeFields id={`diary-shift-${shift?.id ?? person.userId}`} /> : null}
    </FormDialog>
  );
}

type SubChoice = { key: string; subActivityId: string | null; name: string; when: string; at: string; on: boolean };
const WHEN_WORDS: Record<string, string> = { start: "at the start", end: "at the end", during: "any time while on it" };

/** Which sub-activities they do while on it that day (owner, 20 October 2026): the activity's
 *  list from Admin, ticked as they are now, with a time for one at a set time. */
function SubsDialog({ person, line }: { person: PersonDay; line: Line }) {
  const ctx = useDiary();
  const typeId = ctx.needs.get(line.needKey)?.typeId ?? null;
  const list = typeId ? ctx.subActivities[typeId] ?? [] : [];
  const start = (): SubChoice[] => {
    const has = (name: string) => line.subs.find((x) => x.name.toLowerCase() === name.toLowerCase());
    const fromList = list.map((x) => {
      const now = has(x.name);
      return { key: x.id, subActivityId: x.id, name: x.name, when: x.when, at: clock(now?.at ?? x.at ?? line.start), on: !!now };
    });
    const extra = line.subs.filter((x) => !list.some((y) => y.name.toLowerCase() === x.name.toLowerCase()))
      .map((x, i) => ({ key: `kept-${i}`, subActivityId: null, name: x.name, when: x.when, at: clock(x.at ?? line.start), on: true }));
    return [...fromList, ...extra];
  };
  const [rows, setRows] = useState<SubChoice[]>(start);
  const set = (key: string, patch: Partial<SubChoice>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  return (
    <FormDialog portalClassName={PORTAL} title={`${firstName(person.name)} on ${lineTitle(line)}: sub-activities`} description={`${spanWords(line)}. Tick what they do while on it.`}
      submitLabel="Save" successMessage="Sub-activities saved." onOpen={() => setRows(start())}
      trigger={<Button variant="outline"><ListChecks aria-hidden="true" />Sub-activities</Button>}
      submit={(f) => saveLineSubs({ siteId: ctx.siteId, date: ctx.date, departmentId: ctx.departmentFor!, id: line.assignmentId!, userId: person.userId,
        subs: rows.filter((r) => r.on).map((r) => ({ subActivityId: r.subActivityId, name: r.name, when: r.when as "start" | "end" | "at" | "during", at: r.at })) }, ctx.live ? changeOf(f) : {})}>
      <ul className="diary-sub-choices">
        {rows.map((r) => (
          <li key={r.key} className="diary-sub-choice">
            <div className="diary-sub-check">
              <Checkbox id={`sub-${line.key}-${r.key}`} checked={r.on} onCheckedChange={(v) => set(r.key, { on: v === true })} />
              <Label htmlFor={`sub-${line.key}-${r.key}`} className="font-normal">{r.name}<span className="diary-caption">{r.when === "at" ? "" : ` ${WHEN_WORDS[r.when] ?? ""}`}</span></Label>
            </div>
            {r.when === "at" && r.on ? <Input type="time" label="At" step={300} value={r.at} onChange={(v) => set(r.key, { at: v })} min={clock(line.start)} max={clock(line.end)} required /> : null}
          </li>
        ))}
      </ul>
      {ctx.live ? <ChangeFields id={`diary-subs-${line.key}`} /> : null}
    </FormDialog>
  );
}
