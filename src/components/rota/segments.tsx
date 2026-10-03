"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Coffee, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { FormDialog } from "@/components/form-dialog";
import { saveSegments } from "@/lib/rota/actions";
import { PAID_BREAK, SEGMENT_KIND_META, UNPAID_BREAK, clock, describeEntitlement, isPaidBreak, parseClock, segmentProblem, suggestBreaks, type SegmentKind, type YoungBand } from "@/lib/rota/constants";
import { cn } from "@/lib/utils";

const THEME = "turnfin-docs turnfin-module";
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
  const pct = (m: number) => `${(((m - shift.start) / (shift.end - shift.start)) * 100).toFixed(2)}%`;
  return (
    <>
      {/* The shift at a glance, as it will look on the timeline. */}
      <div className="relative h-8 overflow-hidden rounded-[var(--pc-radius-inner)] border border-ui-border bg-[var(--pc-surface-sunken)]" aria-hidden="true">
        {parsed.filter((p) => p.startMinutes >= 0 && p.endMinutes > p.startMinutes).map((p, i) => (
          <span key={i} className={cn("absolute inset-y-0 flex items-center truncate px-1.5 text-xs", p.kind === "break" ? "rota-break text-ui-muted-foreground" : "bg-[var(--pc-primary-soft)] text-[var(--pc-primary-ink)]")}
            style={{ left: pct(Math.max(shift.start, p.startMinutes)), width: `calc(${pct(Math.min(shift.end, p.endMinutes))} - ${pct(Math.max(shift.start, p.startMinutes))})` }}>{p.label}</span>
        ))}
      </div>
      {rows.length === 0 ? <p className="text-sm text-ui-muted-foreground">Nothing planned inside this shift yet: it is all its own duty.</p> : (
        <ul className="space-y-2">
          {[...rows].sort((a, b) => a.start.localeCompare(b.start)).map((r) => (
            <li key={r.key} className="grid grid-cols-[1fr_1fr] gap-2 sm:grid-cols-[6.5rem_6.5rem_7.5rem_minmax(0,1fr)_auto] sm:items-center">
              <Input type="time" aria-label="Starts" value={r.start} onChange={(e) => set(r.key, { start: e.target.value })} required />
              <Input type="time" aria-label="Ends" value={r.end} onChange={(e) => set(r.key, { end: e.target.value })} required />
              <NativeSelect aria-label="What it is" value={r.kind} onChange={(e) => set(r.key, { kind: e.target.value as SegmentKind, label: e.target.value === "break" ? UNPAID_BREAK : "" })}>
                {(Object.keys(SEGMENT_KIND_META) as SegmentKind[]).map((k) => <NativeSelectOption key={k} value={k}>{SEGMENT_KIND_META[k].label}</NativeSelectOption>)}
              </NativeSelect>
              {r.kind === "break" ? (
                <NativeSelect aria-label="Paid or unpaid" value={isPaidBreak(r) ? PAID_BREAK : UNPAID_BREAK} onChange={(e) => set(r.key, { label: e.target.value })}>
                  <NativeSelectOption value={UNPAID_BREAK}>{UNPAID_BREAK}</NativeSelectOption>
                  <NativeSelectOption value={PAID_BREAK}>{PAID_BREAK}</NativeSelectOption>
                </NativeSelect>
              ) : (
                <Input aria-label="Activity" value={r.label} list={`${id}-activities`} maxLength={60}
                  placeholder="For example 25m pool lifeguard" onChange={(e) => set(r.key, { label: e.target.value })} />
              )}
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${r.label || "this"} ${r.start}`} onClick={() => remove(r.key)}><Trash2 aria-hidden="true" /></Button>
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
      {problem && rows.length ? <p className="text-sm text-[var(--pc-warning)]" role="status">{problem}</p> : null}
    </>
  );
}

/** Plan what someone does during their shift: activities (25m pool
 *  lifeguard, Reception) and breaks, each with its times. Saved together;
 *  time with nothing planned is the shift's own duty. */
export function SegmentsDialog({ shift, activities, trigger }: {
  shift: SegmentShift;
  /** Activity names to offer: the site's own first. */
  activities: string[];
  /** The caller's own trigger, e.g. the shift's bar on the timeline. */
  trigger: { label: string; className?: string; style?: CSSProperties; children: ReactNode };
}) {
  const plan = useSegments(shift);
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-2xl"
      onOpen={plan.reset}
      trigger={<Button type="button" variant="ghost" aria-label={trigger.label} className={trigger.className} style={trigger.style}>{trigger.children}</Button>}
      title={`${shift.who ?? "Unfilled"}: ${shift.role}, ${clock(shift.start)}–${clock(shift.end)}`}
      description="What they do when, and their breaks. Time with nothing planned is the shift's own duty."
      submitLabel="Save plan"
      successMessage="Shift planned"
      submit={plan.save}
    >
      <SegmentsFields shift={shift} activities={activities} plan={plan} />
    </FormDialog>
  );
}
