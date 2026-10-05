"use client";

import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2, TriangleAlert, UserPlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { assignActivity, removeActivity, saveActivity } from "@/lib/rota/actions";
import { clock, parseClock } from "@/lib/rota/constants";
import { fitsFor, type Candidate } from "@/lib/rota/timeline";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const THEME = "turnfin-module";
type Option = { id: string; name: string };
export type ActivityValue = { id: string; label: string; start: number; end: number; people: number; requiredTypeId: string | null; note: string };

/** Plan something the site needs covered during the day, or change it. */
export function ActivityDialog({ siteId, date, activity, types, names, trigger }: {
  siteId: string; date: string; activity?: ActivityValue; types: Option[]; names: string[];
  trigger?: { label: string; className?: string; style?: CSSProperties; children: ReactNode };
}) {
  const id = activity ? `act-${activity.id}` : "act-new";
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      trigger={trigger
        ? <Button type="button" variant="ghost" aria-label={trigger.label} className={trigger.className} style={trigger.style}>{trigger.children}</Button>
        : <Button variant="outline" className="min-h-11"><Plus aria-hidden="true" />Add activity</Button>}
      title={activity ? `Change ${activity.label}` : "Add an activity to cover"}
      description="Something the site needs covered, for example the 25m pool lifeguard from opening to close. People cover it from inside their shifts."
      submitLabel={activity ? "Save activity" : "Add activity"}
      successMessage={activity ? "Activity saved" : "Activity added"}
      submit={(formData) => saveActivity(activity?.id ?? null, {
        siteId, date, label: String(formData.get("label") ?? ""), start: String(formData.get("start") ?? ""), end: String(formData.get("end") ?? ""),
        people: Number(formData.get("people") ?? 1), requiredTypeId: String(formData.get("requiredTypeId") ?? ""), note: String(formData.get("note") ?? ""),
        restOfWeek: formData.get("restOfWeek") === "on",
      })}
    >
      <Field label="Activity" htmlFor={`${id}-label`} hint="For example 25m pool lifeguard, Poolside, Reception.">
        <Input id={`${id}-label`} name="label" required minLength={2} maxLength={60} defaultValue={activity?.label} list={`${id}-names`} className="min-h-11" />
      </Field>
      <datalist id={`${id}-names`}>{names.map((n) => <option key={n} value={n} />)}</datalist>
      <div className="grid grid-cols-3 gap-4">
        <Field label="From" htmlFor={`${id}-start`}><Input id={`${id}-start`} name="start" type="time" required defaultValue={clock(activity?.start ?? 390)} className="min-h-11" /></Field>
        <Field label="To" htmlFor={`${id}-end`}><Input id={`${id}-end`} name="end" type="time" required defaultValue={clock(activity?.end ?? 1290)} className="min-h-11" /></Field>
        <Field label="People at once" htmlFor={`${id}-people`}><Input id={`${id}-people`} name="people" type="number" min={1} max={20} required defaultValue={activity?.people ?? 1} className="min-h-11" /></Field>
      </div>
      <Field label="Needs a qualification" htmlFor={`${id}-type`} optional>
        <NativeSelect id={`${id}-type`} name="requiredTypeId" defaultValue={activity?.requiredTypeId ?? ""} className="min-h-11 w-full">
          <NativeSelectOption value="">None</NativeSelectOption>
          {types.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Note" htmlFor={`${id}-note`} optional><Input id={`${id}-note`} name="note" maxLength={200} defaultValue={activity?.note} className="min-h-11" /></Field>
      {activity ? null : (
        <div className="flex min-h-11 items-center gap-3">
          <Checkbox id={`${id}-week`} name="restOfWeek" />
          <Label htmlFor={`${id}-week`} className="font-normal">Also every day after this one, to Sunday</Label>
        </div>
      )}
    </FormDialog>
  );
}

export function RemoveActivity({ id, label }: { id: string; label: string }) {
  return (
    <ConfirmAction
      trigger={<Button variant="ghost" size="icon" className="size-8 pointer-coarse:size-11" aria-label={`Take ${label} off this day`}><Trash2 aria-hidden="true" className="size-3.5" /></Button>}
      title={`Take ${label} off this day?`}
      description="It stops showing as something to cover. Anyone already on it keeps that time in their shift."
      confirmLabel="Take it off"
      successMessage="Activity taken off"
      destructive
      run={() => removeActivity(id)}
    />
  );
}

/** Put people on an activity for a stretch of the day: everyone on shift,
 *  free for all of it first, then those free for part of it, then those busy
 *  and why. Anyone without the qualification it needs is marked. */
export function AssignDialog({ activity, span, candidates, trigger }: {
  activity: { label: string; requiredTypeId: string | null; requiredType: string | null };
  /** The stretch to cover, e.g. a gap. */
  span: { start: number; end: number };
  candidates: Candidate[];
  trigger: { label: string; className?: string; style?: CSSProperties; children: ReactNode };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(clock(span.start));
  const [to, setTo] = useState(clock(span.end));
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string[]>([]);
  const a = parseClock(from), b = parseClock(to);
  const valid = a !== null && b !== null && b > a;
  const fits = useMemo(() => (valid ? fitsFor({ start: a!, end: b!, requiredTypeId: activity.requiredTypeId }, candidates) : []), [valid, a, b, activity.requiredTypeId, candidates]);

  function assign(shiftId: string, name: string, s: number, e: number) {
    start(async () => {
      const result = await assignActivity({ shiftId, label: activity.label, start: clock(s), end: clock(e) });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(`${name} is on ${activity.label}, ${clock(s)}–${clock(e)}`);
      setDone((d) => [...d, shiftId]);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setFrom(clock(span.start)); setTo(clock(span.end)); setDone([]); } }}>
      <Button type="button" variant="ghost" aria-label={trigger.label} className={trigger.className} style={trigger.style} onClick={() => setOpen(true)}>{trigger.children}</Button>
      <DialogContent portalClassName={THEME} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Who covers {activity.label}?</DialogTitle>
          <DialogDescription>{activity.requiredType ? `Needs ${activity.requiredType}. ` : ""}People on shift, free ones first. It becomes that stretch of their shift.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="assign-from">From</Label><Input id="assign-from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="assign-to">To</Label><Input id="assign-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        {!valid ? <p className="text-sm text-[var(--pc-warning)]">The end has to be after the start.</p> : fits.length === 0 ? (
          <p className="text-sm text-ui-muted-foreground">Nobody is on shift this day yet. Add their duties first.</p>
        ) : (
          <ul className="max-h-[50dvh] divide-y divide-ui-border overflow-y-auto">
            {fits.map((f) => {
              const assigned = done.includes(f.candidate.shiftId);
              return (
                <li key={f.candidate.shiftId} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className={cn("block truncate font-medium", f.status === "busy" && "text-ui-muted-foreground")}>{f.candidate.name}</span>
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-ui-muted-foreground">
                      <span>On shift {clock(f.candidate.start)}–{clock(f.candidate.end)}</span>
                      {f.reason ? <span>· {f.reason}</span> : null}
                      {!f.qualified ? <span className="flex items-center gap-1 text-[var(--pc-warning)]"><TriangleAlert aria-hidden="true" className="size-3" />No {activity.requiredType} recorded</span> : null}
                    </span>
                  </span>
                  {assigned ? <span className="flex items-center gap-1 text-sm text-[var(--pc-success)]"><Check aria-hidden="true" className="size-4" />On it</span>
                    : f.status === "busy" ? null : (
                      <Button type="button" variant={f.status === "free" && f.qualified ? "default" : "outline"} disabled={pending} onClick={() => assign(f.candidate.shiftId, f.candidate.name, f.from, f.to)}>
                        <UserPlus aria-hidden="true" />{f.status === "free" ? "Assign" : `${clock(f.from)}–${clock(f.to)}`}
                      </Button>
                    )}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
