"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarOff, CalendarX2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Label } from "@/components/shadcn/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/ui/loading-button";
import { FormFeedbackProvider, useFormFeedback } from "@/components/ui/form-feedback";
import { Notice } from "@/components/ui-kit/notice";
import { formatDay, formatTimeRange, plural } from "@/lib/format";
import { SAVE_UNCONFIRMED_MESSAGE, withTimeout } from "@/lib/save-feedback";
import { cancelClassSessions } from "@/modules/activities/shared/cancellations/actions";

export type CancellableClass = { id: string; name: string; startMinutes: number; durationMinutes: number; cancelled: boolean };

const COPY = {
  day: { trigger: "Close day", title: "Close this day?", confirm: "Close the day", pending: "Closing…",
    intro: "Every class still running this day is ticked. Untick any that go ahead. The ticked classes are cancelled together and can be reopened together." },
  pick: { trigger: "Cancel classes", title: "Cancel classes on this day?", confirm: "Cancel the ticked classes", pending: "Cancelling…",
    intro: "Tick the classes to cancel. Each is cancelled for this day only." },
};

/** Cancels several of one day's classes with one reason. `day` closes the day (every class
 *  ticked, linked as one closure); `pick` starts with none ticked. The weekly classes and
 *  enrolments stay; the affected swimmers join the billing follow-up list. */
export function CancelClasses({ classes, iso, mode, disabled }: { classes: CancellableClass[]; iso: string; mode: "day" | "pick"; disabled?: boolean }) {
  const live = classes.filter(c => !c.cancelled), copy = COPY[mode], id = useId();
  const [open, setOpen] = useState(false), [reason, setReason] = useState("");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const { formRef, summaryRef, ...feedback } = useFormFeedback();
  const router = useRouter();
  const toggle = (courseId: string, on: boolean) => setTicked(current => { const next = new Set(current); if (on) next.add(courseId); else next.delete(courseId); return next; });
  return <Dialog open={open} onOpenChange={value => {
    if (pending) return;
    if (value) { setTicked(new Set(mode === "day" ? live.map(c => c.id) : [])); feedback.reset(); }
    setOpen(value);
  }}>
    <DialogTrigger asChild><Button variant="outline" disabled={disabled || !live.length}>{mode === "day" ? <CalendarOff aria-hidden="true" /> : <CalendarX2 aria-hidden="true" />}{copy.trigger}</Button></DialogTrigger>
    <DialogContent showCloseButton={false} className="max-h-(--overlay-max-height) overflow-y-auto">
      <DialogHeader><DialogTitle>{copy.title}</DialogTitle><DialogDescription>{formatDay(iso)} · {plural(live.length, "class", "classes")} still running</DialogDescription></DialogHeader>
      <p className="text-sm">{copy.intro} The weekly classes and enrolments stay in place, and the affected swimmers are added to the billing follow-up list.</p>
      <FormFeedbackProvider feedback={feedback}><form ref={formRef} method="post" className="space-y-4" onSubmit={event => {
        event.preventDefault();
        if (pending) return;
        startTransition(async () => {
          feedback.reset();
          try {
            const result = await withTimeout(cancelClassSessions({ courseIds: [...ticked], date: iso, reason, closeDay: mode === "day" }));
            if (!result.ok) { feedback.report(result); return; }
            setOpen(false); setReason("");
            toast.success(mode === "day" ? "Day closed. Its classes are added to billing follow-up." : `${plural(ticked.size, "class", "classes")} cancelled. Added to billing follow-up.`);
            router.refresh();
          } catch { feedback.report(SAVE_UNCONFIRMED_MESSAGE); }
        });
      }}>
        <fieldset className="space-y-1" disabled={pending}>
          <legend className="mb-2 text-sm font-semibold">Classes · {ticked.size} of {live.length} ticked</legend>
          <ul className="pc-rows">{live.map(course => <li key={course.id} className="flex min-h-11 items-center gap-3">
            <Checkbox id={`${id}-${course.id}`} checked={ticked.has(course.id)} onCheckedChange={value => toggle(course.id, value === true)} />
            <Label htmlFor={`${id}-${course.id}`} className="font-normal"><span className="tabular-nums">{formatTimeRange(course.startMinutes, course.startMinutes + course.durationMinutes)}</span> · {course.name}</Label>
          </li>)}</ul>
        </fieldset>
        <Textarea label="Reason for cancellation" name="reason" value={reason} onChange={event => setReason(event.target.value)} required maxLength={500} disabled={pending} description="Shared by every ticked class. Keep it about the classes; avoid personal or medical details." />
        {feedback.message ? <div ref={summaryRef} tabIndex={-1}><Notice tone="error" live="alert" title={feedback.message} /></div> : null}
        <DialogFooter><Button variant="outline" type="button" className="min-h-11" disabled={pending} onClick={() => setOpen(false)}>Keep classes</Button><LoadingButton type="submit" className="min-h-11" variant="destructive" pending={pending} pendingLabel={copy.pending} disabled={!ticked.size}>{copy.confirm}</LoadingButton></DialogFooter>
      </form></FormFeedbackProvider>
    </DialogContent>
  </Dialog>;
}
