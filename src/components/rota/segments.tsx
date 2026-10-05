"use client";

import { startTransition, useRef, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Coffee, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/shadcn/sheet";
import { Field } from "@/components/form-dialog";
import { blockAttrs, type BlockPart } from "@/components/rota/actions";
import { FormFeedbackProvider, useFormFeedback } from "@/components/ui/form-feedback";
import { LoadingButton } from "@/components/ui/loading-button";
import { Notice } from "@/components/ui-kit/notice";
import { Tag } from "@/components/ui-kit/tag";
import { saveSegments } from "@/lib/rota/actions";
import { PAID_BREAK, ROTA_WARNING_META, SEGMENT_KIND_META, UNPAID_BREAK, type RotaWarning, clock, describeEntitlement, isPaidBreak, parseClock, segmentProblem, suggestBreaks, type SegmentKind, type YoungBand } from "@/lib/rota/constants";
import { withTimeout } from "@/lib/save-feedback";
import type { ActionResult } from "@/lib/action-result";
import { toast } from "@/lib/toast";

const THEME = "turnfin-module";
type Row = { key: number; start: string; end: string; kind: SegmentKind; label: string };
export type SegmentShift = { id: string; start: number; end: number; role: string; who: string | null; segments: { start: number; end: number; kind: string; label: string }[];
  /** Under 18 that day, for their longer breaks; never the date of birth. */
  young?: YoungBand | null };

/** The rows of a shift's plan being edited, their check, and the moves on
 *  them; shared by the dialog (Day plan) and the side panel (Week plan). */
export function useSegments(shift: SegmentShift) {
  const initial = (): Row[] => shift.segments.map((s, i) => ({ key: i, start: clock(s.start), end: clock(s.end), kind: s.kind === "break" ? "break" : "activity", label: s.label }));
  const [rows, setRows] = useState<Row[]>(initial);
  const [next, setNext] = useState(shift.segments.length);
  const parsed = rows.map((r) => ({ startMinutes: parseClock(r.start) ?? -1, endMinutes: parseClock(r.end) ?? -1, kind: r.kind, label: r.kind === "break" ? r.label || UNPAID_BREAK : r.label }));
  const problem = rows.some((r) => parseClock(r.start) === null || parseClock(r.end) === null) ? "Use times like 10:30." : segmentProblem({ startMinutes: shift.start, endMinutes: shift.end }, parsed);

  function add(kind: SegmentKind) {
    // Into the first free stretch of the shift; a break takes 30 minutes, an activity up to the rest of it.
    const taken = parsed.filter((p) => p.startMinutes >= 0 && p.endMinutes > p.startMinutes).sort((x, y) => x.startMinutes - y.startMinutes);
    let start = shift.start, gapEnd = shift.end;
    for (const t of taken) {
      if (t.startMinutes > start) { gapEnd = t.startMinutes; break; }
      start = Math.max(start, t.endMinutes);
      gapEnd = shift.end;
    }
    if (start >= shift.end) { start = shift.start; gapEnd = shift.end; }
    const end = kind === "break" ? Math.min(gapEnd, start + 30) : gapEnd;
    setRows((all) => [...all, { key: next, start: clock(start), end: clock(end), kind, label: kind === "break" ? UNPAID_BREAK : "" }]);
    setNext((n) => n + 1);
  }
  /** The house rule's breaks for this shift, in time with nothing planned; the manager on shift moves or confirms them. */
  function suggest() {
    const planned = suggestBreaks({ startMinutes: shift.start, endMinutes: shift.end }, parsed.filter((p) => p.startMinutes >= 0 && p.endMinutes > p.startMinutes), shift.young ?? null);
    setRows(planned.map((p, i) => ({ key: next + i, start: clock(p.startMinutes), end: clock(p.endMinutes), kind: p.kind === "break" ? "break" : "activity", label: p.label })));
    setNext((n) => n + planned.length);
  }
  return {
    rows, parsed, problem, add, suggest,
    set: (key: number, patch: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r))),
    remove: (key: number) => setRows((all) => all.filter((x) => x.key !== key)),
    reset: () => { setRows(initial()); setNext(shift.segments.length); },
    save: () => problem ? Promise.resolve({ ok: false as const, error: problem }) : saveSegments(shift.id, rows.map((r) => ({ start: r.start, end: r.end, kind: r.kind, label: r.label }))),
  };
}

/** The shift at a glance, its activities and breaks as rows, and the moves:
 *  add an activity or a break, or suggest the house rule's breaks. */
export function SegmentsFields({ shift, activities, plan }: { shift: SegmentShift; activities: string[]; plan: ReturnType<typeof useSegments> }) {
  const { rows, parsed, problem, set, remove, add, suggest } = plan;
  const id = `seg-${shift.id}`;
  const share = (m: number) => ((Math.min(Math.max(m, shift.start), shift.end) - shift.start) / Math.max(1, shift.end - shift.start));
  const pct = (m: number) => `${(share(m) * 100).toFixed(2)}%`;
  const shown = parsed.filter((p) => p.startMinutes >= 0 && p.endMinutes > p.startMinutes);
  return (
    <>
      {/* The shift at a glance, as it will look on the timeline: once something is planned. The
          rows below say the same in words, so the strip is hidden from screen readers. */}
      {shown.length ? (
        <div className="relative h-11" aria-hidden="true">
          {shown.map((p, i) => {
            const Icon = SEGMENT_KIND_META[p.kind as SegmentKind]?.icon ?? Coffee;
            // Words only where they fit (about 60px of a 480px sheet); the icon otherwise.
            const wide = share(p.endMinutes) - share(p.startMinutes) >= 0.14;
            return (
              <span key={i} title={`${p.label || SEGMENT_KIND_META[p.kind as SegmentKind]?.label} ${clock(p.startMinutes)}–${clock(p.endMinutes)}`}
                className={p.kind === "break"
                  ? "rota-break absolute inset-y-0 flex items-center justify-center gap-1 overflow-hidden rounded-[var(--pc-radius-card)] px-2 text-xs text-ui-muted-foreground shadow-[inset_0_0_0_1px_var(--pc-line)]"
                  : "absolute inset-y-0 flex items-center justify-center gap-1 overflow-hidden rounded-[var(--pc-radius-card)] bg-[image:var(--pc-block-next)] px-2 text-xs font-semibold text-[var(--pc-on-block-next)]"}
                style={{ left: pct(p.startMinutes), width: `calc(${pct(p.endMinutes)} - ${pct(p.startMinutes)} - 2px)` }}>
                {wide ? <span className="truncate">{p.label || SEGMENT_KIND_META[p.kind as SegmentKind]?.label}</span> : <Icon aria-hidden="true" className="size-4 shrink-0" />}
              </span>
            );
          })}
        </div>
      ) : null}
      {rows.length === 0 ? <p className="text-sm text-ui-muted-foreground">Nothing planned inside this shift yet: it is all its own duty.</p> : (
        <ul className="pc-rows" aria-label="Activities and breaks">
          {[...rows].sort((a, b) => a.start.localeCompare(b.start)).map((r) => (
            <li key={r.key} className="pc-row items-end">
              <div className="grid min-w-0 flex-1 basis-full grid-cols-2 gap-3 sm:basis-0 sm:grid-cols-[6.5rem_6.5rem_minmax(0,1fr)]">
                <Field label="Starts" htmlFor={`${id}-${r.key}-start`}><Input id={`${id}-${r.key}-start`} type="time" value={r.start} onChange={(e) => set(r.key, { start: e.target.value })} required /></Field>
                <Field label="Ends" htmlFor={`${id}-${r.key}-end`}><Input id={`${id}-${r.key}-end`} type="time" value={r.end} onChange={(e) => set(r.key, { end: e.target.value })} required /></Field>
                <Field label="What it is" htmlFor={`${id}-${r.key}-kind`}>
                  <NativeSelect id={`${id}-${r.key}-kind`} value={r.kind} className="w-full" onChange={(e) => set(r.key, { kind: e.target.value as SegmentKind, label: e.target.value === "break" ? UNPAID_BREAK : "" })}>
                    {(Object.keys(SEGMENT_KIND_META) as SegmentKind[]).map((k) => <NativeSelectOption key={k} value={k}>{SEGMENT_KIND_META[k].label}</NativeSelectOption>)}
                  </NativeSelect>
                </Field>
                <div className="col-span-2 sm:col-span-3">
                  {r.kind === "break" ? (
                    <Field label="Paid or unpaid" htmlFor={`${id}-${r.key}-paid`}>
                      <NativeSelect id={`${id}-${r.key}-paid`} value={isPaidBreak(r) ? PAID_BREAK : UNPAID_BREAK} className="w-full" onChange={(e) => set(r.key, { label: e.target.value })}>
                        <NativeSelectOption value={UNPAID_BREAK}>{UNPAID_BREAK}</NativeSelectOption>
                        <NativeSelectOption value={PAID_BREAK}>{PAID_BREAK}</NativeSelectOption>
                      </NativeSelect>
                    </Field>
                  ) : (
                    <Field label="Activity" htmlFor={`${id}-${r.key}-label`}>
                      <Input id={`${id}-${r.key}-label`} value={r.label} list={`${id}-activities`} maxLength={60}
                        placeholder="For example 25m pool lifeguard" onChange={(e) => set(r.key, { label: e.target.value })} />
                    </Field>
                  )}
                </div>
              </div>
              <div className="pc-row-trail">
                <Button type="button" variant="outline" size="icon" aria-label={`Remove ${r.label || "this"} ${r.start}`} onClick={() => remove(r.key)}><Trash2 aria-hidden="true" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <datalist id={`${id}-activities`}>{activities.map((a) => <option key={a} value={a} />)}</datalist>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => add("activity")}><Plus aria-hidden="true" />Add activity</Button>
        <Button type="button" variant="outline" onClick={() => add("break")}><Coffee aria-hidden="true" />Add break</Button>
        <Button type="button" variant="outline" onClick={suggest}><Sparkles aria-hidden="true" />Suggest breaks</Button>
      </div>
      <p className="text-sm text-ui-muted-foreground">Breaks for {Math.round(((shift.end - shift.start) / 60) * 10) / 10} hours: {describeEntitlement(shift.end - shift.start, shift.young ?? null)}{shift.young ? ` They are ${shift.young === "under16" ? "under 16" : "16 or 17"}.` : ""} Unpaid breaks come off their hours.</p>
      {problem && rows.length ? <Notice tone="warning" title={problem} /> : null}
    </>
  );
}

type SheetTriggerParts = { label: string; className?: string; style?: CSSProperties; children: ReactNode; block?: BlockPart };

/** One shift's plan in a side panel, the one editor for it (the Week plan's cells and the Day
 *  plan's blocks): its warnings, what they do when inside it (activities and breaks, saved
 *  together with "Save plan"), and the caller's own moves on the shift (change or cancel it).
 *  Like FormDialog, a failed save keeps the panel open with the rows and the error beside them;
 *  closing it drops unsaved rows. Controlled (`open`) for a roster cell, or self-contained with
 *  a trigger built from parts, so a server page can hand one over. */
export function ShiftPlanSheet({ shift, title, description, warnings = [], activities, editable, actions, readOnlyNote, open, onOpenChange, trigger }: {
  shift: SegmentShift;
  /** "Ava Example · Mon 5 Oct". */
  title: string;
  /** "Poolside · Aquatics · 07:00–15:00". */
  description: string;
  /** Its warnings, from their metadata. */
  warnings?: RotaWarning[];
  /** Activity names to offer: the site's own first. */
  activities: string[];
  /** The plan can be changed here (a rota manager, a shift planned in Turnfin). */
  editable: boolean;
  /** Change or cancel the shift, beside the save. */
  actions?: ReactNode;
  /** Why a read-only plan cannot be changed. */
  readOnlyNote?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: SheetTriggerParts;
}) {
  const [own, setOwn] = useState(false);
  const isOpen = open ?? own;
  const setOpen = onOpenChange ?? setOwn;
  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      {trigger ? (
        <SheetTrigger asChild>
          <Button type="button" variant={trigger.block ? "link" : "ghost"} aria-label={trigger.label} className={trigger.className} style={trigger.style} {...blockAttrs(trigger.block)}>{trigger.children}</Button>
        </SheetTrigger>
      ) : null}
      <SheetContent portalClassName={THEME} className="flex w-full flex-col gap-0 sm:max-w-xl">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
          {warnings.length ? <div className="flex flex-wrap gap-2 pt-2">{warnings.map((w) => <Tag key={w} meta={ROTA_WARNING_META[w]} />)}</div> : null}
        </SheetHeader>
        {isOpen ? (editable
          ? <PlanForm shift={shift} activities={activities} actions={actions} onSaved={() => setOpen(false)} />
          : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
              <ul className="pc-rows" aria-label="Activities and breaks">
                {shift.segments.length ? shift.segments.map((g, i) => (
                  <li key={i} className="pc-row"><span className="pc-row-body"><span className="pc-row-title">{g.label}</span><span className="pc-row-hint tabular-nums">{clock(g.start)}–{clock(g.end)}</span></span></li>
                )) : <li className="text-sm text-ui-muted-foreground">Nothing planned inside this shift.</li>}
              </ul>
              {readOnlyNote ? <p className="text-sm text-ui-muted-foreground">{readOnlyNote}</p> : null}
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
          )) : null}
      </SheetContent>
    </Sheet>
  );
}

/** The plan's rows as a form, with FormDialog's guarantees: one save at a time, a timeout, the
 *  error inline (and focused) rather than a toast, the fields held while it saves. */
function PlanForm({ shift, activities, actions, onSaved }: { shift: SegmentShift; activities: string[]; actions?: ReactNode; onSaved: () => void }) {
  const router = useRouter();
  const plan = useSegments(shift);
  const { formRef, summaryRef, ...feedback } = useFormFeedback();
  const [pending, start] = useTransition();
  const submitting = useRef(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    feedback.reset();
    start(async () => {
      try {
        const result = await withTimeout<ActionResult>(plan.save());
        if (result.ok) {
          toast.success(`${shift.who ?? "The unfilled shift"}: plan saved`);
          router.refresh();
          startTransition(onSaved);
        } else startTransition(() => feedback.report(result));
      } catch {
        startTransition(() => feedback.report("We could not confirm the save. Check the plan before trying again."));
      } finally {
        submitting.current = false;
      }
    });
  }
  const formId = `plan-${shift.id}`;
  // The caller's actions open dialogs of their own, so they sit outside this form (a submit
  // inside a portalled dialog still bubbles through React to the form around it).
  return (
    <FormFeedbackProvider feedback={feedback}>
      <form id={formId} ref={formRef} onSubmit={submit} aria-busy={pending} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4">
        <fieldset disabled={pending} className="flex min-w-0 flex-col gap-4">
          <legend className="sr-only">What they do when</legend>
          <SegmentsFields shift={shift} activities={activities} plan={plan} />
        </fieldset>
        {feedback.message ? <div ref={summaryRef} tabIndex={-1}><Notice tone="error" live="alert" title={feedback.message} /></div> : null}
      </form>
      <SheetFooter className="mt-0 flex-row flex-wrap items-center justify-between gap-2 border-t border-ui-border p-6">
        <div className="flex flex-wrap gap-2">{actions}</div>
        <LoadingButton type="submit" form={formId} pending={pending}>Save plan</LoadingButton>
      </SheetFooter>
    </FormFeedbackProvider>
  );
}
