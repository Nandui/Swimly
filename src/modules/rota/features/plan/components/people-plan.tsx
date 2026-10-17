"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Coffee, Plus, SplitSquareHorizontal, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, initials } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { Field, FormDialog } from "@/components/form-dialog";
import { Notice } from "@/components/ui-kit/notice";
import { SearchField } from "@/components/ui-kit/search-field";
import { Tag } from "@/components/ui-kit/tag";
import { ChangeFields, changeOf } from "@/modules/rota/shared/components/change-fields";
import { FillSheet, handOverGap, type GapRef } from "@/modules/rota/shared/components/fill-sheet";
import { assign, planTeacher, putOnActivity } from "@/modules/rota/shared/actions";
import { AreaLanesFields, type AreaLanes } from "@/modules/rota/shared/components/area-lanes";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/shadcn/native-select";
import { freeTime } from "@/modules/rota/shared/plan-rows";
import { removePlanShift, saveBreaks, savePlanShift, whoForShift } from "@/modules/rota/features/plan/server/actions";
import { clock, parseClock, slotProblem } from "@/modules/rota/shared/constants";
import { ANY_DEPARTMENT, type Person, type ShiftOption } from "@/modules/rota/shared/day";
import type { Fit } from "@/modules/rota/shared/fit";
import { ROTA_FIT_META, ROTA_SHIFT_NOTE_META, qualificationShort } from "@/modules/rota/shared/meta";
import { duration } from "@/modules/rota/shared/shifts";
import { toast } from "@/components/ui/toast";

/** Who's working, by person (owner decision, 8 October 2026): put someone on a shift, then give
 *  them activities from the day's gaps that fit it and that they are qualified for. On a wide
 *  screen each person is a row of the Plan's timeline (`DayPlan`, staff on the left; owner request,
 *  13 October 2026); below 1024px they are this list. Opening a person shows the shift, its breaks
 *  to place, what they could take, and any under-18 rest warning. Warnings never stop anything. */

const THEME = "turnfin-module";
type Ctx = { siteId: string; departmentId: string; date: string; dateLabel: string; live: boolean; canChange: boolean;
  /** Department names by id, to say when something would lend them to another department. */
  departmentNames?: Record<string, string>;
  /** Every department's activities and the site's areas, to put someone on any activity. */
  anyTypes?: TypeOption[]; areaList?: AreaLanes[] };
/** An activity on the organisation's list, with its department. */
export type TypeOption = { id: string; name: string; departmentId: string; departmentName: string;
  /** The qualification it needs, to offer it first for an area short of that type of staff. */
  requiredTypeId?: string | null };
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** The department a person's changes are made for when every department shows on one Plan: the
 *  one their shift that day is on, else the viewer's (`fallback`). */
export const departmentFor = (p: Person, fallback: string) => p.planned[0]?.departmentId ?? fallback;

export function PeoplePlan({ people, everyDepartment, ...ctx }: Ctx & { people: Person[]; everyDepartment?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = people.find((p) => p.userId === openId) ?? null;
  return (
    <>
      <ul className="pc-rows" aria-label="Who's working">
        {people.map((p) => (
          <li key={p.userId}>
            <Button type="button" variant="outline" className="pc-row h-auto w-full justify-start whitespace-normal text-start font-normal" onClick={() => setOpenId(p.userId)}>
              <Avatar size="lg"><AvatarFallback>{initials(p.name)}</AvatarFallback></Avatar>
              <span className="pc-row-body"><span className="pc-row-title">{p.name}</span><span className="pc-row-hint tabular-nums">{summary(p)}</span></span>
              {warned(p) ? <span className="pc-row-trail"><Tag meta={p.rest.length ? ROTA_SHIFT_NOTE_META.young : ROTA_SHIFT_NOTE_META.noBreak} label={checkLabel(p)} /></span> : null}
            </Button>
          </li>
        ))}
      </ul>
      <ShiftSheet person={open} onClose={() => setOpenId(null)} {...ctx} departmentId={open && everyDepartment ? departmentFor(open, ctx.departmentId) : ctx.departmentId} />
    </>
  );
}

/** One person's day in a sheet: their shift, breaks and what they could take. */
export function ShiftSheet({ person, onClose, ...ctx }: Ctx & { person: Person | null; onClose: () => void }) {
  return (
    <Sheet open={!!person} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent portalClassName={THEME} className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        {person ? <ShiftBody key={person.userId} person={person} {...ctx} /> : null}
      </SheetContent>
    </Sheet>
  );
}

/** Whether someone's day has something to look at, and that in a few words. */
export function warned(p: Person) {
  return p.rest.length > 0 || p.breakClashes.length > 0 || p.warnings.some((w) => w !== "break") || p.shift.parts.some((x) => x.unplaced.length);
}

/** The first thing to look at on someone's day, in a few words. */
export function checkLabel(p: Person) {
  return p.rest.length ? "Under-18 rest" : p.breakClashes.length > 0 ? "Break needs cover" : p.shift.parts.some((x) => x.unplaced.length) ? "Breaks to place" : "To check";
}

function summary(p: Person) {
  const parts = p.shift.parts.map((x) => `${clock(x.start)} to ${clock(x.end)}`).join(" and ");
  return `${p.shift.parts.length > 1 ? "Split shift: " : ""}${parts} · ${duration(p.shift.paidMinutes)} paid · ${p.activities.length ? p.activities.join(", ") : "no activities yet"}`;
}

/** One person's day: shift, breaks, what they could take. */
function ShiftBody({ person: p, siteId, departmentId, date, dateLabel, live, canChange, departmentNames, anyTypes = [], areaList = [] }: Ctx & { person: Person }) {
  const router = useRouter();
  const done = () => router.refresh();
  const [cover, setCover] = useState<GapRef | null>(null);
  const breaks = p.shift.parts.flatMap((x) => x.breaks);
  const last = p.shift.parts[p.shift.parts.length - 1];
  // A split shift's next part: after a few hours off, inside the day.
  const nextStart = Math.min((last?.end ?? 720) + 180, 1260), nextEnd = Math.min(nextStart + 240, 1435);
  const unplaced = p.shift.parts.flatMap((x) => x.unplaced);
  const open = p.options.filter((o) => o.ok), closed = p.options.filter((o) => !o.ok);
  return (
    <>
      <SheetHeader className="p-6 pb-4">
        <SheetTitle>{p.name}</SheetTitle>
        <SheetDescription>{dateLabel} · {duration(p.shift.paidMinutes)} paid</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-6 px-6 pb-6">
        {p.rest.map((w) => <Notice key={w} tone="warning" title="Under-18 rest">{w}</Notice>)}

        <section aria-labelledby="shift-parts" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="shift-parts" className="font-semibold">{p.shift.parts.length > 1 ? "Split shift" : "Shift"}</h3>
            {canChange ? (
              <ShiftTimes title="Add another part (split shift)" submitLabel="Add part" start={nextStart} end={nextEnd} live={live} fid={`shift-split-${p.userId}`}
                description="A second stretch of work the same day, with unpaid time off between. Breaks are worked out for each part; paid hours add up across the day."
                trigger={<Button type="button" variant="outline"><SplitSquareHorizontal aria-hidden="true" />Add another part</Button>}
                submit={(fd) => savePlanShift(null, { siteId, departmentId, date, userId: p.userId, start: text(fd, "start"), end: text(fd, "end") }, changeOf(fd))} />
            ) : null}
          </div>
          <ul className="pc-rows">
            {p.shift.parts.flatMap((x, i) => {
              const prev = i > 0 ? p.shift.parts[i - 1] : null;
              const off = prev && x.start > prev.end ? (
                <li key={`off-${x.start}`} className="pc-row" data-muted="">
                  <span className="pc-row-body">
                    <span className="pc-row-title tabular-nums">Off {clock(prev.end)} to {clock(x.start)}</span>
                    <span className="pc-row-hint">{duration(x.start - prev.end)} between the parts, unpaid</span>
                  </span>
                </li>
              ) : null;
              const planned = x.planned ? p.planned.find((s) => s.startMinutes === x.start && s.endMinutes === x.end) ?? p.planned.find((s) => s.startMinutes < x.end && x.start < s.endMinutes) : null;
              return [off, (
                <li key={x.start} className="pc-row">
                  <span className="pc-row-body">
                    <span className="pc-row-title tabular-nums">{clock(x.start)} to {clock(x.end)}</span>
                    <span className="pc-row-hint">{x.planned ? "Planned shift" : "Worked out from their activities"} · {duration(x.end - x.start)}</span>
                  </span>
                  {canChange ? (
                    <span className="pc-row-trail">
                      {planned && planned.departmentId === departmentId ? <>
                        <ShiftTimes title="Change the shift" submitLabel="Save shift" start={x.start} end={x.end} live={live} fid={`shift-${planned.id}`}
                          trigger={<Button type="button" variant="outline">Change</Button>}
                          submit={(fd) => savePlanShift(planned.id, { siteId, departmentId, date, userId: p.userId, start: text(fd, "start"), end: text(fd, "end") }, changeOf(fd))} />
                        <FormDialog portalClassName={THEME} destructive cancelLabel="Keep it" title="Take this shift off?"
                          description="Activities they are on stay, with a shift worked out from them. Breaks placed in it go."
                          trigger={<Button type="button" variant="ghost" className="text-ui-destructive">Remove</Button>}
                          submitLabel="Remove shift" successMessage="Shift removed" onSuccess={() => router.refresh()}
                          submit={(fd) => removePlanShift(planned.id, changeOf(fd))}>
                          {live ? <ChangeFields id={`shift-off-${planned.id}`} /> : <p className="text-sm text-ui-muted-foreground">They are told if the week is shared.</p>}
                        </FormDialog>
                      </> : !x.planned ? (
                        <ShiftTimes title="Make it a planned shift" submitLabel="Plan shift" start={x.start} end={x.end} live={live} fid={`shift-new-${x.start}`}
                          trigger={<Button type="button" variant="outline">Plan it</Button>}
                          submit={(fd) => savePlanShift(null, { siteId, departmentId, date, userId: p.userId, start: text(fd, "start"), end: text(fd, "end") }, changeOf(fd))} />
                      ) : null}
                    </span>
                  ) : null}
                </li>
              )];
            })}
          </ul>
        </section>

        <section aria-labelledby="shift-breaks" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="shift-breaks" className="font-semibold">Breaks</h3>
            {canChange && breaks.length ? (
              <div className="flex flex-wrap gap-2">
                <FormDialog portalClassName={THEME} width="sm:max-w-lg" title={`Place ${p.name.split(" ")[0]}'s breaks`}
                  description="The handbook sets how long; you choose when. A break during an activity leaves that time to cover."
                  trigger={<Button type="button" variant="outline"><Coffee aria-hidden="true" />Place breaks</Button>}
                  submitLabel="Save breaks" successMessage="Breaks placed" onSuccess={() => router.refresh()}
                  submit={(fd) => saveBreaks({ siteId, departmentId, date, userId: p.userId, breaks: breaks.map((b, i) => ({ start: text(fd, `break-${i}`), minutes: b.end - b.start, paid: b.paid })) }, changeOf(fd))}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {breaks.map((b, i) => (
                      <Field key={i} label={`${b.end - b.start} minutes, ${b.paid ? "paid" : "unpaid"}`} htmlFor={`break-${p.userId}-${i}`}>
                        <Input id={`break-${p.userId}-${i}`} name={`break-${i}`} type="time" step={300} required defaultValue={clock(b.start)} className="min-h-11" />
                      </Field>
                    ))}
                  </div>
                  {live ? <ChangeFields id={`breaks-${p.userId}`} /> : null}
                </FormDialog>
                {breaks.some((b) => b.pinned) ? (
                  <FormDialog portalClassName={THEME} title="Use the suggested times?" description="The breaks you placed go, and Turnfin suggests times again in time they have nothing on."
                    trigger={<Button type="button" variant="ghost">Use suggestions</Button>}
                    submitLabel="Use suggestions" successMessage="Breaks back to suggestions" onSuccess={() => router.refresh()}
                    submit={(fd) => saveBreaks({ siteId, departmentId, date, userId: p.userId, breaks: [] }, changeOf(fd))}>
                    {live ? <ChangeFields id={`breaks-reset-${p.userId}`} /> : <p className="text-sm text-ui-muted-foreground">Nothing else changes.</p>}
                  </FormDialog>
                ) : null}
              </div>
            ) : null}
          </div>
          {breaks.length || unplaced.length ? (
            <ul className="pc-rows">
              {breaks.map((b) => (
                <li key={b.start} className="pc-row">
                  <span className="pc-tile-icon" aria-hidden="true"><Coffee /></span>
                  <span className="pc-row-body"><span className="pc-row-title tabular-nums">{clock(b.start)} to {clock(b.end)}</span><span className="pc-row-hint">{b.end - b.start} minutes, {b.paid ? "paid" : "unpaid"}</span></span>
                  <span className="pc-row-trail"><Tag meta={b.pinned ? ROTA_SHIFT_NOTE_META.break : ROTA_SHIFT_NOTE_META.suggested} label={b.pinned ? "Placed" : undefined} /></span>
                </li>
              ))}
              {unplaced.length ? <li className="pc-row"><span className="pc-row-body"><span className="pc-row-title">No free time for {unplaced.reduce((n, b) => n + b.minutes, 0)} minutes of breaks</span><span className="pc-row-hint">Place them yourself and cover that time.</span></span><span className="pc-row-trail"><Tag meta={ROTA_SHIFT_NOTE_META.noBreak} /></span></li> : null}
            </ul>
          ) : <p className="text-sm text-ui-muted-foreground">No break for a shift of 4 hours or less.</p>}
          {p.breakClashes.map((c) => (
            <Notice key={`${c.start}${c.label}`} tone="warning" title="Break during an activity">
              <span className="flex flex-col items-start gap-2">
                <span>{`${clock(c.start)} to ${clock(c.end)} on ${c.label} needs cover while they are on their break.`}</span>
                {canChange && c.assignment ? (
                  <Button type="button" variant="outline" onClick={() => setCover(handOverGap({ siteId, date, dateLabel, typeId: c.assignment!.typeId, what: c.label, requiredName: c.assignment!.requiredName, departmentId },
                    { id: c.assignment!.id, needId: c.assignment!.needId, place: c.assignment!.place, userId: p.userId, name: p.name, start: c.assignment!.start, end: c.assignment!.end }, { start: c.start, end: c.end }))}>
                    <ArrowLeftRight aria-hidden="true" />Find cover for the break
                  </Button>
                ) : null}
              </span>
            </Notice>
          ))}
        </section>

        {p.shift.parts.some((x) => x.work.length) ? (
          <section aria-labelledby="shift-on" className="flex flex-col gap-2">
            <h3 id="shift-on" className="font-semibold">On now</h3>
            <ul className="pc-rows">{p.shift.parts.flatMap((x) => x.work).map((w, i) => (
              <li key={i} className="pc-row"><span className="pc-row-body"><span className="pc-row-title">{w.label}</span><span className="pc-row-hint tabular-nums">{clock(w.start)} to {clock(w.end)}</span></span></li>
            ))}</ul>
            {p.warnings.length ? <span className="rota-tags">{p.warnings.map((w) => <Tag key={w} meta={ROTA_FIT_META[w]} />)}</span> : null}
          </section>
        ) : null}

        <section aria-labelledby="shift-take" className="flex flex-col gap-2">
          <h3 id="shift-take" className="font-semibold">Activities they could take</h3>
          <p className="text-sm text-ui-muted-foreground">The day&apos;s gaps inside their shift, at the time they are free for each.</p>
          {p.options.length === 0 ? <p className="text-sm">Nothing on the day needs someone during their shift.</p> : (
            <ul className="pc-rows">
              {[...open, ...closed].map((o) => <OptionRow key={o.key} option={o} person={p} siteId={siteId} date={date} live={live} canChange={canChange} onDone={done} departmentId={departmentId}
                lentTo={o.departmentId !== departmentId && o.departmentId !== ANY_DEPARTMENT ? departmentNames?.[o.departmentId] ?? "another department" : null} />)}
            </ul>
          )}
          {canChange && anyTypes.length ? (
            <AnyActivity person={p} types={anyTypes} areas={areaList} siteId={siteId} departmentId={departmentId} date={date} live={live} onDone={done}
              within={freeTime(p, p.shift.parts.flatMap((x) => x.work))[0] ?? { start: p.shift.parts[0]?.start ?? 420, end: p.shift.parts[0]?.end ?? 480 }} />
          ) : null}
        </section>
      </div>
      <FillSheet gap={cover} live={live} onClose={() => setCover(null)} />
    </>
  );
}

/** Something a person on shift could take, with a button to put them on it. `within` narrows the
 *  times offered to one stretch of their free time; `lentTo` names another department's work
 *  (lending, owner request, 13 October 2026). */
export function OptionRow({ option: o, person, siteId, date, live, canChange, onDone, within, lentTo, departmentId }: {
  option: ShiftOption; person: Person; siteId: string; date: string; live: boolean; canChange: boolean; onDone: () => void;
  within?: { start: number; end: number }; lentTo?: string | null;
  /** The plan it is done from: a class taken goes on their shift there. */
  departmentId?: string;
}) {
  const what = `${o.classRef && o.detail ? o.detail : o.name} in ${o.area}`;
  const from = within ? Math.max(o.start, within.start) : o.start, to = within ? Math.min(o.end, within.end) : o.end;
  const hint = [`${clock(o.gapStart)}–${clock(o.gapEnd)} needs someone`, lentTo ? `for ${lentTo}` : null, o.classRef ? null : o.detail, o.requiredName ? `needs ${qualificationShort(o.requiredName)}` : null].filter(Boolean).join(" · ");
  const fid = `take-${o.key.replace(/\W+/g, "-")}`;
  return (
    <li className="pc-row" {...(o.ok ? {} : { "data-muted": "" })}>
      <span className="pc-row-body">
        <span className="pc-row-title">{what}</span>
        <span className="pc-row-hint">{hint}</span>
        {o.why ? <span className="pc-row-hint">{o.why}</span> : null}
      </span>
      {o.ok && canChange ? (
        <span className="pc-row-trail">
          <FormDialog portalClassName={THEME} width="sm:max-w-lg" title={`Put ${person.name.split(" ")[0]} on ${what}`}
            description={o.classRef ? "They teach the whole class." : "For all of this time or part of it."}
            trigger={<Button type="button" variant="outline" className="tabular-nums"><Plus aria-hidden="true" />{clock(o.classRef ? o.gapStart : from)}–{clock(o.classRef ? o.gapEnd : to)}</Button>}
            submitLabel="Put on" successMessage="Put on the rota" onSuccess={onDone}
            submit={(fd) => o.classRef
              ? planTeacher({ siteId, date, classRef: o.classRef, userId: person.userId, departmentId }, changeOf(fd))
              : assign(null, { needId: o.needId!, place: o.place!, userId: person.userId, start: text(fd, "start"), end: text(fd, "end"), departmentId }, changeOf(fd))}>
            {o.classRef ? <p className="text-sm tabular-nums">{clock(o.gapStart)} to {clock(o.gapEnd)}{o.detail ? `, ${o.detail}` : ""}.</p> : (
              <div className="grid grid-cols-2 gap-4">
                <Field label="From" htmlFor={`${fid}-start`}><Input id={`${fid}-start`} name="start" type="time" step={300} required defaultValue={clock(from)} min={clock(o.gapStart)} max={clock(o.gapEnd)} className="min-h-11" /></Field>
                <Field label="To" htmlFor={`${fid}-end`}><Input id={`${fid}-end`} name="end" type="time" step={300} required defaultValue={clock(to)} min={clock(o.gapStart)} max={clock(o.gapEnd)} className="min-h-11" /></Field>
              </div>
            )}
            {live ? <ChangeFields id={fid} /> : null}
          </FormDialog>
        </span>
      ) : null}
    </li>
  );
}

/** Put someone on any activity on the list for part of their shift, even when nothing on the day
 *  needs it yet (owner report, 14 October 2026): it is added for that time with them on it. Their
 *  own department's activities come first; another department's lends them. */
export function AnyActivity({ person, within, types, areas, siteId, departmentId, date, live, onDone }: {
  person: Person; within: { start: number; end: number }; types: TypeOption[]; areas: AreaLanes[]; siteId: string; departmentId: string; date: string; live: boolean; onDone: () => void;
}) {
  const fid = `any-${person.userId}-${within.start}`;
  const first = person.name.split(" ")[0];
  const byDept = new Map<string, TypeOption[]>();
  for (const t of [...types].sort((a, b) => Number(b.departmentId === departmentId) - Number(a.departmentId === departmentId) || a.departmentName.localeCompare(b.departmentName) || a.name.localeCompare(b.name))) {
    byDept.set(t.departmentName, [...(byDept.get(t.departmentName) ?? []), t]);
  }
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg" title={`Put ${first} on an activity`}
      description="Any activity on the list, even one the day does not have yet. It is added for this time with them on it."
      trigger={<Button type="button" variant="outline" className="self-start"><Plus aria-hidden="true" />Put on any activity</Button>}
      submitLabel="Put on" successMessage="Put on the rota" onSuccess={onDone}
      submit={(fd) => putOnActivity({ siteId, date, userId: person.userId, typeId: text(fd, "typeId"), place: text(fd, "place"), start: text(fd, "start"), end: text(fd, "end"),
        lanes: fd.getAll("lanes").map(String) }, changeOf(fd))}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Activity" htmlFor={`${fid}-type`}>
          <NativeSelect id={`${fid}-type`} name="typeId" required defaultValue={types.find((t) => t.departmentId === departmentId)?.id ?? types[0]?.id ?? ""} className="min-h-11 w-full">
            {[...byDept].map(([dept, list]) => (
              <NativeSelectOptGroup key={dept} label={dept}>
                {list.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
              </NativeSelectOptGroup>
            ))}
          </NativeSelect>
        </Field>
        <AreaLanesFields fid={fid} areas={areas} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="From" htmlFor={`${fid}-start`}><Input id={`${fid}-start`} name="start" type="time" step={300} required defaultValue={clock(within.start)} className="min-h-11" /></Field>
        <Field label="To" htmlFor={`${fid}-end`}><Input id={`${fid}-end`} name="end" type="time" step={300} required defaultValue={clock(within.end)} className="min-h-11" /></Field>
      </div>
      {live ? <ChangeFields id={fid} /> : null}
    </FormDialog>
  );
}

function ShiftTimes({ title, description, submitLabel, start, end, live, fid, trigger, submit }: {
  title: string; description?: string; submitLabel: string; start: number; end: number; live: boolean; fid: string; trigger: React.ReactNode;
  submit: (fd: FormData) => ReturnType<typeof savePlanShift>;
}) {
  const router = useRouter();
  return (
    <FormDialog portalClassName={THEME} title={title} description={description} trigger={trigger} submitLabel={submitLabel} successMessage="Shift saved" onSuccess={() => router.refresh()} submit={submit}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Starts" htmlFor={`${fid}-start`}><Input id={`${fid}-start`} name="start" type="time" step={300} required defaultValue={clock(start)} className="min-h-11" /></Field>
        <Field label="Ends" htmlFor={`${fid}-end`}><Input id={`${fid}-end`} name="end" type="time" step={300} required defaultValue={clock(end)} className="min-h-11" /></Field>
      </div>
      {live ? <ChangeFields id={fid} /> : null}
    </FormDialog>
  );
}

/** "Add staff": choose the shift's times, then who, best fit first (free, not off, shortest week). */
export function AddShiftSheet({ siteId, departmentId, departments, date, dateLabel, live }: Omit<Ctx, "canChange"> & {
  /** With every department on the Plan: the ones the shift may be on, to choose from. */
  departments?: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}><UserPlus aria-hidden="true" />Add staff</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent portalClassName={THEME} className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle>Add staff to this day</SheetTitle>
            <SheetDescription>{dateLabel}. Choose their shift, then who. It starts as No activity, and you give its time to the day&apos;s work on the plan. Someone already on that day gets a split shift when the times do not overlap.</SheetDescription>
          </SheetHeader>
          {open ? <AddShiftBody siteId={siteId} departmentId={departmentId} departments={departments} date={date} live={live} onClose={() => setOpen(false)} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function AddShiftBody({ siteId, departmentId: first, departments, date, live, onClose }: { siteId: string; departmentId: string; departments?: { id: string; name: string }[]; date: string; live: boolean; onClose: () => void }) {
  const router = useRouter();
  const [departmentId, setDepartmentId] = useState(first);
  const [times, setTimes] = useState({ start: "15:00", end: "21:00" });
  const [fits, setFits] = useState<Fit[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const s = parseClock(times.start), e = parseClock(times.end);
  const slot = s !== null && e !== null ? slotProblem(s, e) : null;
  const valid = s !== null && e !== null && e - s >= 15 && !slot;
  useEffect(() => {
    if (!valid) return;
    let stale = false;
    whoForShift({ siteId, date, start: s!, end: e! }).then((list) => { if (!stale) setFits(list); });
    return () => { stale = true; };
  }, [siteId, date, s, e, valid]);
  const formId = "rota-add-shift";
  function put(userId: string) {
    const fd = new FormData(document.getElementById(formId) as HTMLFormElement);
    const change = changeOf(fd);
    if (!valid) { setError(slot ?? "The shift ends before it starts."); return; }
    if (live && !change.reason) { setError("This day has come. Choose why it changed first."); return; }
    start(async () => {
      setError(null);
      const result = await savePlanShift(null, { siteId, departmentId, date, userId, start: times.start, end: times.end }, change);
      if (!result.ok) { setError(result.error); return; }
      toast.success("Put on a shift");
      onClose();
      router.refresh();
    });
  }
  const shown = (fits ?? []).filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="flex flex-col gap-4 px-6 pb-6">
      <form id={formId} className="flex flex-col gap-4" onSubmit={(ev) => ev.preventDefault()}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Starts" htmlFor="rota-add-start"><Input id="rota-add-start" type="time" step={300} value={times.start} onChange={(ev) => setTimes((t) => ({ ...t, start: ev.target.value }))} className="min-h-11" /></Field>
          <Field label="Ends" htmlFor="rota-add-end"><Input id="rota-add-end" type="time" step={300} value={times.end} onChange={(ev) => setTimes((t) => ({ ...t, end: ev.target.value }))} className="min-h-11" /></Field>
        </div>
        {departments && departments.length > 1 ? (
          <Field label="Department" htmlFor="rota-add-department">
            <NativeSelect id="rota-add-department" value={departmentId} onChange={(ev) => setDepartmentId(ev.target.value)} className="min-h-11 w-full">
              {departments.map((d) => <NativeSelectOption key={d.id} value={d.id}>{d.name}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
        ) : null}
        {live ? <ChangeFields id="rota-add" /> : null}
      </form>
      <SearchField label="Search people" value={query} onValueChange={setQuery} placeholder="Search people at this site" />
      {error ? <p role="alert" className="text-sm text-ui-destructive">{error}</p> : null}
      {!valid ? <p className="text-sm text-ui-destructive">The shift ends before it starts.</p> : fits === null ? <p className="text-sm text-ui-muted-foreground" role="status">Finding who is free</p> : shown.length === 0 ? (
        <p className="text-sm text-ui-muted-foreground">Nobody matches.</p>
      ) : (
        <ul className="pc-rows" aria-label="People, best fit first">
          {shown.map((f) => (
            <li key={f.userId} className="pc-row" {...(f.issues.includes("off") ? { "data-muted": "" } : {})}>
              <Avatar size="lg"><AvatarFallback>{initials(f.name)}</AvatarFallback></Avatar>
              <span className="pc-row-body">
                <span className="pc-row-title">{f.name}</span>
                <span className="pc-row-hint">{f.day.length ? `On ${f.day.map((w) => `${w.label} ${clock(w.start)}–${clock(w.end)}`).join(", ")}` : "Nothing else that day"} · {f.weekMinutes ? `${duration(f.weekMinutes)} this week` : "no hours this week"}</span>
                <span className="rota-tags">
                  {f.issues.filter((i) => i !== "missing" && i !== "expired").length === 0 ? <Tag meta={ROTA_FIT_META.good} label="Free" /> : f.issues.filter((i) => i !== "missing" && i !== "expired").map((i) => (
                    <Tag key={i} meta={ROTA_FIT_META[i]} label={i === "long" ? `Makes a ${duration(f.dayLength)} day` : undefined} />
                  ))}
                </span>
              </span>
              <Button type="button" variant="outline" size="icon" aria-label={`Put ${f.name} on this shift`} disabled={pending} onClick={() => put(f.userId)}>
                <Plus aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
