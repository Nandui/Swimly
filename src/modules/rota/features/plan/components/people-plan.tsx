"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coffee, Plus, TriangleAlert, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, initials } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { Field, FormDialog } from "@/components/form-dialog";
import { Notice } from "@/components/ui-kit/notice";
import { SearchField } from "@/components/ui-kit/search-field";
import { Tag } from "@/components/ui-kit/tag";
import { ChangeFields, changeOf } from "@/modules/rota/shared/components/change-fields";
import { assign, planTeacher } from "@/modules/rota/shared/actions";
import { removePlanShift, saveBreaks, savePlanShift, whoForShift } from "@/modules/rota/features/plan/server/actions";
import { clock, parseClock } from "@/modules/rota/shared/constants";
import type { Person, ShiftOption } from "@/modules/rota/shared/day";
import type { Fit } from "@/modules/rota/shared/fit";
import { ROTA_FIT_META, ROTA_SHIFT_NOTE_META, qualificationShort } from "@/modules/rota/shared/meta";
import { duration } from "@/modules/rota/shared/shifts";
import { toast } from "@/lib/toast";

/** Who's working, by person (owner decision, 8 October 2026, from the approved mockup): put
 *  someone on a shift, then give them activities from the day's gaps that fit it and that they
 *  are qualified for. Each row is a person's day: their shift's outline, what they are on, and
 *  their breaks (solid when the manager placed them, dashed while suggested). Opening a row shows
 *  the shift, its breaks to place, what they could take, and any under-18 rest warning. Below
 *  1024px the same people are a list. Warnings never stop anything. */

const THEME = "turnfin-module";
type Ctx = { siteId: string; departmentId: string; date: string; dateLabel: string; live: boolean; canChange: boolean };
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

export function PeoplePlan({ people, ...ctx }: Ctx & { people: Person[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = people.find((p) => p.userId === openId) ?? null;
  const { from, to } = useMemo(() => {
    const starts = people.map((p) => p.shift.start), ends = people.map((p) => p.shift.end);
    return { from: Math.min(7 * 60, ...starts.map((m) => Math.floor(m / 60) * 60)), to: Math.max(22 * 60, ...ends.map((m) => Math.ceil(m / 60) * 60)) };
  }, [people]);
  const span = to - from;
  const at = (m: number) => `${((m - from) / span) * 100}%`;
  const width = (a: number, b: number) => `calc(${((b - a) / span) * 100}% - 2px)`;
  const ticks = Array.from({ length: Math.floor(span / 120) + 1 }, (_, i) => from + i * 120).filter((t) => t < to);
  return (
    <>
      <div className="rota-tl rota-people">
        <div className="rota-tl-row" aria-hidden="true">
          <span />
          <div className="rota-tl-hours">{ticks.map((t) => <span key={t} style={{ left: at(t), translate: t === from ? "0 0" : "-50% 0" }}>{clock(t)}</span>)}</div>
        </div>
        {people.map((p) => {
          const label = summary(p);
          return (
            <div key={p.userId} className="rota-tl-row">
              <Button type="button" variant="ghost" className="rota-tl-label h-auto items-stretch whitespace-normal" onClick={() => setOpenId(p.userId)} aria-label={`${p.name}: ${label}. Open their shift`}>
                <span className="rota-tl-name"><span>{p.name}</span></span>
                <small className="tabular-nums">{p.shift.parts.map((x) => `${clock(x.start)}–${clock(x.end)}`).join(", ")} · {duration(p.shift.paidMinutes)} paid</small>
                {warned(p) ? <small className="rota-people-warn"><TriangleAlert aria-hidden="true" />{checkLabel(p)}</small> : null}
              </Button>
              <div className="rota-tl-track" role="img" aria-label={label}>
                {p.shift.parts.map((x) => <span key={`s${x.start}`} className="rota-people-shift" data-planned={x.planned ? "" : undefined} style={{ left: at(x.start), width: width(x.start, x.end) }} />)}
                {p.shift.parts.flatMap((x) => x.work).map((w, i) => (
                  <span key={`w${i}`} className="pc-block" data-block={p.warnings.includes("off") ? "absent" : "next"} data-density="compact" style={{ left: `calc(${at(w.start)} + 1px)`, width: width(w.start, w.end) }}>
                    <span className="pc-block-body"><span className="pc-block-title">{w.label}</span><span className="pc-block-hint">{clock(w.start)}–{clock(w.end)}</span></span>
                  </span>
                ))}
                {p.shift.parts.flatMap((x) => x.breaks).map((b) => (
                  <span key={`b${b.start}`} className="rota-people-break" data-pinned={b.pinned ? "" : undefined} style={{ left: at(b.start), width: width(b.start, b.end) }} title={`${b.paid ? "Paid" : "Unpaid"} break ${clock(b.start)}–${clock(b.end)}`}>
                    <Coffee aria-hidden="true" />
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        <div className="rota-tl-key">
          <span><i className="rota-people-shift" data-planned="" />Planned shift</span>
          <span><i style={{ background: "var(--pc-block-next)" }} />On an activity</span>
          <span><i className="rota-people-break" data-pinned="" />Break placed</span>
          <span><i className="rota-people-break" />Break suggested</span>
          <span>Open a person to give them activities and place their breaks</span>
        </div>
      </div>
      <ul className="pc-rows rota-agenda" aria-label="Who's working">
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
      <Sheet open={!!open} onOpenChange={(o) => { if (!o) setOpenId(null); }}>
        <SheetContent portalClassName={THEME} className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
          {open ? <ShiftBody key={open.userId} person={open} {...ctx} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function warned(p: Person) {
  return p.rest.length > 0 || p.breakClashes.length > 0 || p.warnings.length > 0 || p.shift.parts.some((x) => x.unplaced.length);
}

/** The first thing to look at on someone's day, in a few words. */
function checkLabel(p: Person) {
  return p.rest.length ? "Under-18 rest" : p.breakClashes.length ? "Break needs cover" : p.shift.parts.some((x) => x.unplaced.length) ? "Breaks to place" : "To check";
}

function summary(p: Person) {
  const parts = p.shift.parts.map((x) => `${clock(x.start)} to ${clock(x.end)}`).join(" and ");
  return `${parts} · ${duration(p.shift.paidMinutes)} paid · ${p.activities.length ? p.activities.join(", ") : "no activities yet"}`;
}

/** One person's day: shift, breaks, what they could take. */
function ShiftBody({ person: p, siteId, departmentId, date, dateLabel, live, canChange }: Ctx & { person: Person }) {
  const router = useRouter();
  const done = () => router.refresh();
  const breaks = p.shift.parts.flatMap((x) => x.breaks);
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
          <h3 id="shift-parts" className="font-semibold">Shift</h3>
          <ul className="pc-rows">
            {p.shift.parts.map((x) => {
              const planned = x.planned ? p.planned.find((s) => s.startMinutes === x.start && s.endMinutes === x.end) ?? p.planned.find((s) => s.startMinutes < x.end && x.start < s.endMinutes) : null;
              return (
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
              );
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
          {p.breakClashes.map((c) => <Notice key={`${c.start}${c.label}`} tone="warning" title="Break during an activity">{`${clock(c.start)} to ${clock(c.end)} on ${c.label} needs cover while they are on their break.`}</Notice>)}
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
          {p.options.length === 0 ? <p className="text-sm">Nothing on this department&apos;s day needs someone during their shift.</p> : (
            <ul className="pc-rows">
              {[...open, ...closed].map((o) => <OptionRow key={o.key} option={o} person={p} siteId={siteId} date={date} live={live} canChange={canChange} onDone={done} />)}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function OptionRow({ option: o, person, siteId, date, live, canChange, onDone }: { option: ShiftOption; person: Person; siteId: string; date: string; live: boolean; canChange: boolean; onDone: () => void }) {
  const what = `${o.name} in ${o.area}`;
  const hint = [`${clock(o.gapStart)}–${clock(o.gapEnd)} needs someone`, o.detail, o.requiredName ? `needs ${qualificationShort(o.requiredName)}` : null].filter(Boolean).join(" · ");
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
            trigger={<Button type="button" variant="outline" className="tabular-nums"><Plus aria-hidden="true" />{clock(o.start)}–{clock(o.end)}</Button>}
            submitLabel="Put on" successMessage="Put on the rota" onSuccess={onDone}
            submit={(fd) => o.classRef
              ? planTeacher({ siteId, date, classRef: o.classRef, userId: person.userId }, changeOf(fd))
              : assign(null, { needId: o.needId!, place: o.place!, userId: person.userId, start: text(fd, "start"), end: text(fd, "end") }, changeOf(fd))}>
            {o.classRef ? <p className="text-sm tabular-nums">{clock(o.gapStart)} to {clock(o.gapEnd)}{o.detail ? `, ${o.detail}` : ""}.</p> : (
              <div className="grid grid-cols-2 gap-4">
                <Field label="From" htmlFor={`${fid}-start`}><Input id={`${fid}-start`} name="start" type="time" step={900} required defaultValue={clock(o.start)} min={clock(o.gapStart)} max={clock(o.gapEnd)} className="min-h-11" /></Field>
                <Field label="To" htmlFor={`${fid}-end`}><Input id={`${fid}-end`} name="end" type="time" step={900} required defaultValue={clock(o.end)} min={clock(o.gapStart)} max={clock(o.gapEnd)} className="min-h-11" /></Field>
              </div>
            )}
            {live ? <ChangeFields id={fid} /> : null}
          </FormDialog>
        </span>
      ) : null}
    </li>
  );
}

function ShiftTimes({ title, submitLabel, start, end, live, fid, trigger, submit }: {
  title: string; submitLabel: string; start: number; end: number; live: boolean; fid: string; trigger: React.ReactNode;
  submit: (fd: FormData) => ReturnType<typeof savePlanShift>;
}) {
  const router = useRouter();
  return (
    <FormDialog portalClassName={THEME} title={title} trigger={trigger} submitLabel={submitLabel} successMessage="Shift saved" onSuccess={() => router.refresh()} submit={submit}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Starts" htmlFor={`${fid}-start`}><Input id={`${fid}-start`} name="start" type="time" step={900} required defaultValue={clock(start)} className="min-h-11" /></Field>
        <Field label="Ends" htmlFor={`${fid}-end`}><Input id={`${fid}-end`} name="end" type="time" step={900} required defaultValue={clock(end)} className="min-h-11" /></Field>
      </div>
      {live ? <ChangeFields id={fid} /> : null}
    </FormDialog>
  );
}

/** "Add to shift": choose the times, then who, best fit first (free, not off, shortest week). */
export function AddShiftSheet({ siteId, departmentId, date, dateLabel, live }: Omit<Ctx, "canChange">) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}><UserPlus aria-hidden="true" />Add to shift</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent portalClassName={THEME} className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle>Add to shift</SheetTitle>
            <SheetDescription>{dateLabel}. Choose the times, then who. You give them activities after.</SheetDescription>
          </SheetHeader>
          {open ? <AddShiftBody siteId={siteId} departmentId={departmentId} date={date} live={live} onClose={() => setOpen(false)} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function AddShiftBody({ siteId, departmentId, date, live, onClose }: { siteId: string; departmentId: string; date: string; live: boolean; onClose: () => void }) {
  const router = useRouter();
  const [times, setTimes] = useState({ start: "15:00", end: "21:00" });
  const [fits, setFits] = useState<Fit[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const s = parseClock(times.start), e = parseClock(times.end);
  const valid = s !== null && e !== null && e - s >= 15;
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
    if (!valid) { setError("The shift ends before it starts."); return; }
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
          <Field label="Starts" htmlFor="rota-add-start"><Input id="rota-add-start" type="time" step={900} value={times.start} onChange={(ev) => setTimes((t) => ({ ...t, start: ev.target.value }))} className="min-h-11" /></Field>
          <Field label="Ends" htmlFor="rota-add-end"><Input id="rota-add-end" type="time" step={900} value={times.end} onChange={(ev) => setTimes((t) => ({ ...t, end: ev.target.value }))} className="min-h-11" /></Field>
        </div>
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
