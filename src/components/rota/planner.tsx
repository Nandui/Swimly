"use client";

import { useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Coffee, Plus, TriangleAlert, UserPlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { blockAttrs, type BlockPart } from "@/components/rota/actions";
import { assignActivity, saveShift } from "@/lib/rota/actions";
import { PAID_BREAK, ROTA_CHANGE_REASON_META, ROTA_CHANGE_REASONS, UNPAID_BREAK, clock, parseClock, type RotaChangeReason } from "@/lib/rota/constants";
import { fitsFor, type Candidate } from "@/lib/rota/timeline";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const THEME = "turnfin-module";
const STEP = 15;
type Option = { id: string; name: string };

export type PlacePart = { label: string; className: string; style?: CSSProperties; children: ReactNode; block: BlockPart };
type Place = {
  id: string; date: string; startMinutes: number; endMinutes: number; role: string; what: string; note: string;
  userId: string | null; who: string | null; requiredTypeId: string | null; requiredType: string | null; departmentId: string | null;
};

/** Put someone on a booking place (or a shift that needs cover): the people on shift that day,
 *  free for all of it and qualified first, then free for part of it, then busy and why; anyone
 *  else at the bottom. Once the week has started it asks why, as every change does. */
export function AssignPlaceDialog({ place, siteId, live, candidates, people, trigger, suggested }: {
  place: Place; siteId: string; live: boolean; candidates: Candidate[]; people: Option[];
  trigger: PlacePart | { label: string; children: ReactNode };
  suggested?: RotaChangeReason;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [reason, setReason] = useState<RotaChangeReason | "">(suggested ?? "");
  const [note, setNote] = useState("");
  const [other, setOther] = useState("");
  const fits = useMemo(() => fitsFor({ start: place.startMinutes, end: place.endMinutes, requiredTypeId: place.requiredTypeId },
    candidates.filter((c) => c.userId && c.userId !== place.userId)), [candidates, place]);
  const onShift = new Set(candidates.map((c) => c.userId));
  const rest = people.filter((p) => !onShift.has(p.id) && p.id !== place.userId);
  const time = `${clock(place.startMinutes)}–${clock(place.endMinutes)}`;

  function put(userId: string, name: string) {
    if (live && !reason) { toast.error("Say why it changed: the week has started."); return; }
    start(async () => {
      const result = await saveShift(place.id, {
        siteId, date: place.date, start: clock(place.startMinutes), end: clock(place.endMinutes), role: place.role,
        departmentId: place.departmentId ?? "", requiredTypeId: place.requiredTypeId ?? "", userId, note: place.note, count: 1,
        ...(live ? { reason, changeNote: note } : {}),
      });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(`${name} is on ${place.what}, ${time}`);
      setOpen(false);
      router.refresh();
    });
  }

  const parts = "className" in trigger ? trigger : null;
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setReason(suggested ?? ""); setNote(""); setOther(""); } }}>
      {parts ? (
        <Button type="button" variant="link" aria-label={parts.label} className={parts.className} style={parts.style} {...blockAttrs(parts.block)} onClick={() => setOpen(true)}>{parts.children}</Button>
      ) : (
        <Button type="button" variant="outline" aria-label={trigger.label} onClick={() => setOpen(true)}>{trigger.children}</Button>
      )}
      <DialogContent portalClassName={THEME} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Who does {place.what}?</DialogTitle>
          <DialogDescription>
            {time}{place.requiredType ? ` · needs ${place.requiredType}` : ""}{place.who ? ` · ${place.who} is on it now` : ""}. People on shift, free ones first.
          </DialogDescription>
        </DialogHeader>
        {live ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`place-reason-${place.id}`}>Why it changed</Label>
              <NativeSelect id={`place-reason-${place.id}`} value={reason} onChange={(e) => setReason(e.target.value as RotaChangeReason)} className="min-h-11 w-full">
                <NativeSelectOption value="">Choose a reason</NativeSelectOption>
                {ROTA_CHANGE_REASONS.map((r) => <NativeSelectOption key={r} value={r}>{ROTA_CHANGE_REASON_META[r].label}</NativeSelectOption>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`place-note-${place.id}`}>Note <span className="font-normal text-ui-muted-foreground">(optional)</span></Label>
              <Input id={`place-note-${place.id}`} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className="min-h-11" />
            </div>
          </div>
        ) : null}
        {fits.length === 0 ? <p className="text-sm text-ui-muted-foreground">Nobody else is on shift then. Choose someone below, or add their shift first.</p> : (
          <ul className="max-h-[45dvh] divide-y divide-ui-border overflow-y-auto">
            {fits.map((f) => (
              <li key={f.candidate.shiftId} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className={cn("block truncate font-semibold", f.status === "busy" && "text-ui-muted-foreground")}>{f.candidate.name}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-ui-muted-foreground">
                    <span>On shift {clock(f.candidate.start)}–{clock(f.candidate.end)}</span>
                    {f.reason ? <span>· {f.reason}</span> : null}
                    {!f.qualified ? <span className="flex items-center gap-1 text-[var(--pc-warning)]"><TriangleAlert aria-hidden="true" className="size-3" />No {place.requiredType} recorded</span> : null}
                  </span>
                </span>
                {f.status === "busy" ? null : (
                  <Button type="button" variant={f.status === "free" && f.qualified ? "default" : "outline"} disabled={pending} onClick={() => put(f.candidate.userId!, f.candidate.name)}>
                    <UserPlus aria-hidden="true" />{f.status === "free" ? "Put on" : "Put on anyway"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {rest.length ? (
          <div className="flex flex-wrap items-end gap-2 border-t border-ui-border pt-4">
            <div className="min-w-48 flex-1 space-y-1.5">
              <Label htmlFor={`place-other-${place.id}`}>Someone not on shift</Label>
              <NativeSelect id={`place-other-${place.id}`} value={other} onChange={(e) => setOther(e.target.value)} className="min-h-11 w-full">
                <NativeSelectOption value="">Choose a person</NativeSelectOption>
                {rest.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>)}
              </NativeSelect>
            </div>
            <Button type="button" variant="outline" disabled={!other || pending} onClick={() => put(other, rest.find((p) => p.id === other)?.name ?? "They")}>
              <UserPlus aria-hidden="true" />Put on
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** A choice for a stretch of someone's shift: a duty that must be covered (a pool's lifeguard),
 *  a booking's place, a break, or anything else. */
export type PlanCover = { label: string; start: number; end: number; requiredTypeId: string | null; requiredType: string | null };
export type PlanPlace = Place & { booking: string };
type PlanShift = { id: string; start: number; end: number; who: string; userId: string | null; types: string[]; date: string; busy: { start: number; end: number }[] };

/** The free time in a person's shift (the shift block on their lane): drag across it, or press
 *  it, to plan what they do then. A press picks the free stretch it lands in. */
export function DragToPlan({ shift, siteId, live, covers, places, activities, label, className, style, children }: {
  shift: PlanShift; siteId: string; live: boolean; covers: PlanCover[]; places: PlanPlace[]; activities: string[];
  label: string; className?: string; style?: CSSProperties; children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [drag, setDrag] = useState<{ a: number; b: number; moved: boolean } | null>(null);
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  const at = (clientX: number) => {
    const box = ref.current!.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    return shift.start + Math.floor((ratio * (shift.end - shift.start)) / STEP) * STEP;
  };
  /** The free stretch around a moment: from the end of what comes before to the start of what comes after. */
  const freeAround = (m: number) => {
    const before = shift.busy.filter((b) => b.end <= m).map((b) => b.end);
    const after = shift.busy.filter((b) => b.start > m).map((b) => b.start);
    return { start: Math.max(shift.start, ...before), end: Math.min(shift.end, ...after) };
  };
  const span = drag ? { start: Math.min(drag.a, drag.b), end: Math.max(drag.a, drag.b) + STEP } : null;
  const pct = (m: number) => `${(((m - shift.start) / (shift.end - shift.start)) * 100).toFixed(3)}%`;

  return (
    <>
      <Button ref={ref} type="button" variant="link" aria-label={label} className={cn("rota-free", className)} style={style}
        onPointerDown={(e) => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); const m = at(e.clientX); setDrag({ a: m, b: m, moved: false }); }}
        onPointerMove={(e) => { if (!drag) return; const m = at(e.clientX); if (m !== drag.b) setDrag({ ...drag, b: m, moved: true }); }}
        onPointerUp={() => { if (!drag || !span) return; setRange(drag.moved ? span : freeAround(drag.a)); setDrag(null); }}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRange(freeAround(shift.start)); } }}>
        {children}
        {span && drag?.moved ? (
          <span className="rota-drag-range" style={{ left: pct(span.start), width: `calc(${pct(span.end)} - ${pct(span.start)})` }}>
            <span className="tabular-nums">{clock(span.start)}–{clock(span.end)}</span>
          </span>
        ) : null}
      </Button>
      {range ? <PlanTimeDialog shift={shift} range={range} siteId={siteId} live={live} covers={covers} places={places} activities={activities} onClose={() => setRange(null)} /> : null}
    </>
  );
}

/** What is someone doing for a stretch of their shift? The duties to cover then (each pool's
 *  lifeguard first), the bookings with a place to fill then, a break, or anything else. A
 *  missing qualification is shown, never refused. */
function PlanTimeDialog({ shift, range, siteId, live, covers, places, activities, onClose }: {
  shift: PlanShift; range: { start: number; end: number }; siteId: string; live: boolean; covers: PlanCover[]; places: PlanPlace[]; activities: string[]; onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [from, setFrom] = useState(clock(range.start));
  const [to, setTo] = useState(clock(range.end));
  const [other, setOther] = useState("");
  const [reason, setReason] = useState<RotaChangeReason | "">("");
  const a = parseClock(from), b = parseClock(to);
  const valid = a !== null && b !== null && b > a && a >= shift.start && b <= shift.end;
  const overlaps = (x: { start: number; end: number }) => valid && x.start < b! && a! < x.end;
  const duties = covers.filter(overlaps);
  const open = places.filter((p) => !p.userId && overlaps({ start: p.startMinutes, end: p.endMinutes }));
  const holds = (typeId: string | null) => !typeId || shift.types.includes(typeId);

  const done = (message: string) => { toast.success(message); onClose(); router.refresh(); };
  const addSegment = (label: string, kind: "activity" | "break") => start(async () => {
    const result = await assignActivity({ shiftId: shift.id, label, start: from, end: to, kind });
    if (!result.ok) { toast.error(result.error); return; }
    done(`${shift.who}: ${label}, ${from}–${to}`);
  });
  const takePlace = (p: PlanPlace) => {
    if (live && !reason) { toast.error("Say why it changed: the week has started."); return; }
    start(async () => {
      const result = await saveShift(p.id, {
        siteId, date: p.date, start: clock(p.startMinutes), end: clock(p.endMinutes), role: p.role, departmentId: p.departmentId ?? "",
        requiredTypeId: p.requiredTypeId ?? "", userId: shift.userId ?? "", note: p.note, count: 1, ...(live ? { reason, changeNote: "" } : {}),
      });
      if (!result.ok) { toast.error(result.error); return; }
      done(`${shift.who} is on ${p.what}, ${clock(p.startMinutes)}–${clock(p.endMinutes)}`);
    });
  };
  const missing = (type: string | null) => <span className="flex items-center gap-1 text-[var(--pc-warning)]"><TriangleAlert aria-hidden="true" className="size-3" />No {type} recorded</span>;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent portalClassName={THEME} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>What is {shift.who} doing?</DialogTitle>
          <DialogDescription>On shift {clock(shift.start)}–{clock(shift.end)}. Choose the time, then what they do.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="plan-from">From</Label><Input id="plan-from" type="time" step={900} value={from} onChange={(e) => setFrom(e.target.value)} className="min-h-11" /></div>
          <div className="space-y-1.5"><Label htmlFor="plan-to">To</Label><Input id="plan-to" type="time" step={900} value={to} onChange={(e) => setTo(e.target.value)} className="min-h-11" /></div>
        </div>
        {!valid ? <p className="text-sm text-[var(--pc-warning)]">Choose a time inside their shift, {clock(shift.start)}–{clock(shift.end)}.</p> : (
          <div className="flex max-h-[55dvh] flex-col gap-4 overflow-y-auto">
            {duties.length ? (
              <section aria-labelledby="plan-duties" className="flex flex-col gap-2">
                <h3 id="plan-duties" className="text-sm font-semibold">Cover</h3>
                <ul className="divide-y divide-ui-border">
                  {duties.map((d) => (
                    <li key={d.label} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block font-semibold">{d.label}</span>
                        <span className="flex flex-wrap gap-x-2 text-xs text-ui-muted-foreground"><span>Needed {clock(d.start)}–{clock(d.end)}</span>{holds(d.requiredTypeId) ? null : missing(d.requiredType)}</span>
                      </span>
                      <Button type="button" variant={holds(d.requiredTypeId) ? "default" : "outline"} disabled={pending} onClick={() => addSegment(d.label, "activity")}>Put on</Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {open.length ? (
              <section aria-labelledby="plan-bookings" className="flex flex-col gap-2">
                <h3 id="plan-bookings" className="text-sm font-semibold">Bookings with a place to fill</h3>
                {live ? (
                  <NativeSelect aria-label="Why it changed" value={reason} onChange={(e) => setReason(e.target.value as RotaChangeReason)} className="min-h-11 w-full">
                    <NativeSelectOption value="">Why it changed (the week has started)</NativeSelectOption>
                    {ROTA_CHANGE_REASONS.map((r) => <NativeSelectOption key={r} value={r}>{ROTA_CHANGE_REASON_META[r].label}</NativeSelectOption>)}
                  </NativeSelect>
                ) : null}
                <ul className="divide-y divide-ui-border">
                  {open.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block font-semibold">{p.what}</span>
                        <span className="flex flex-wrap gap-x-2 text-xs text-ui-muted-foreground"><span>{clock(p.startMinutes)}–{clock(p.endMinutes)}</span>{holds(p.requiredTypeId) ? null : missing(p.requiredType)}</span>
                      </span>
                      <Button type="button" variant={holds(p.requiredTypeId) ? "default" : "outline"} disabled={pending} onClick={() => takePlace(p)}>Put on</Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section aria-labelledby="plan-break" className="flex flex-col gap-2">
              <h3 id="plan-break" className="text-sm font-semibold">Break</h3>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={pending} onClick={() => addSegment(UNPAID_BREAK, "break")}><Coffee aria-hidden="true" />Unpaid break</Button>
                <Button type="button" variant="outline" disabled={pending} onClick={() => addSegment(PAID_BREAK, "break")}><Coffee aria-hidden="true" />Paid break</Button>
              </div>
            </section>
            <section aria-labelledby="plan-other" className="flex flex-col gap-2">
              <h3 id="plan-other" className="text-sm font-semibold">Something else</h3>
              <div className="flex gap-2">
                <Input aria-labelledby="plan-other" value={other} maxLength={60} placeholder="For example Reception, Plant room" list="plan-other-names" onChange={(e) => setOther(e.target.value)} className="min-h-11 flex-1" />
                <datalist id="plan-other-names">{activities.map((n) => <option key={n} value={n} />)}</datalist>
                <Button type="button" variant="outline" disabled={pending || other.trim().length < 2} onClick={() => addSegment(other.trim(), "activity")}><Plus aria-hidden="true" />Add</Button>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
