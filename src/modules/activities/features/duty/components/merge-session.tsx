"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Merge, Undo2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/ui/loading-button";
import { FormFeedbackProvider, useFormFeedback } from "@/components/ui/form-feedback";
import { Notice } from "@/components/ui-kit/notice";
import { formatTime, plural } from "@/lib/format";
import { SAVE_UNCONFIRMED_MESSAGE, withTimeout } from "@/lib/save-feedback";
import type { DutyClass } from "@/modules/activities/features/duty/server/data";
import { mergeClassSession, undoClassMerge } from "@/modules/activities/shared/merges/actions";

/** Classes this one can join today: the same level, still running as itself. */
export function mergeTargets(course: DutyClass, courses: DutyClass[]) {
  return courses.filter(other => other.id !== course.id && other.levelId === course.levelId && !other.cancellation && !other.mergedInto);
}

/** Why a class cannot be merged away today, or null when it can. */
export function mergeBlocker(course: DutyClass, targets: DutyClass[]) {
  if (course.joined.length) return "Other classes have joined this one today.";
  if (course.attendanceRecorded > 0) return "Attendance has already been taken for this class.";
  if (!targets.length) return "No other class at this level runs today.";
  return null;
}

export function MergeSession({ course, courses, date, disabled }: { course: DutyClass; courses: DutyClass[]; date: string; disabled?: boolean }) {
  const targets = mergeTargets(course, courses), blocker = mergeBlocker(course, targets);
  const [open, setOpen] = useState(false), [into, setInto] = useState(""), [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const { formRef, summaryRef, ...feedback } = useFormFeedback();
  const router = useRouter();
  const host = targets.find(t => t.id === into);
  const together = host ? host.swimmers.length + host.joined.reduce((n, j) => n + j.swimmers, 0) + course.swimmers.length : 0;
  const label = `Merge class: ${course.name}, ${formatTime(course.startMinutes)}`;
  return <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value); }}>
    <DialogTrigger asChild><Button variant="outline" disabled={disabled || !!blocker} title={blocker ?? undefined} aria-label={blocker ? `${label}. ${blocker}` : label}><Merge aria-hidden="true" /><span className="pc-only-wide">Merge</span></Button></DialogTrigger>
    <DialogContent showCloseButton={false} className="max-h-(--overlay-max-height) overflow-y-auto">
      <DialogHeader><DialogTitle>Merge this class into another?</DialogTitle><DialogDescription>{course.name} · {formatTime(course.startMinutes)} · {plural(course.swimmers.length, "swimmer")}</DialogDescription></DialogHeader>
      <p className="text-sm">For today only. Its swimmers join the class you choose, at the same level, and are marked on that register. Their attendance still counts towards their own class. The weekly class and enrolments stay as they are.</p>
      {course.started ? <Notice tone="warning" title="This class has already been started." description="Its start is kept, but it can no longer be marked today." /> : null}
      <FormFeedbackProvider feedback={feedback}><form ref={formRef} method="post" className="space-y-4" onSubmit={event => {
        event.preventDefault();
        if (pending) return;
        startTransition(async () => {
          feedback.reset();
          try {
            const result = await withTimeout(mergeClassSession({ fromCourseId: course.id, intoCourseId: into, date, reason }));
            if (!result.ok) { feedback.report(result); return; }
            setOpen(false); setInto(""); setReason(""); toast.success(`Merged into ${host?.name ?? "the other class"}.`); router.refresh();
          } catch { feedback.report(SAVE_UNCONFIRMED_MESSAGE); }
        });
      }}>
        <Select label="Merge into" name="intoCourseId" required value={into} onValueChange={setInto} disabled={pending} placeholder="Choose a class at this level"
          options={targets.map(t => ({ value: t.id, label: `${formatTime(t.startMinutes)} · ${t.name}`, description: [t.instructor ?? "No instructor assigned", t.location || "Pool area not set"].join(" · ") }))} />
        {host ? <p className="text-sm" role="status">{host.instructor ?? "Nobody yet"} will teach {plural(together, "swimmer")} together{host.capacity !== null && together > host.capacity ? `, over the usual ${host.capacity} places` : ""}.</p> : null}
        <Textarea label="Reason for merging" name="reason" value={reason} onChange={event => setReason(event.target.value)} required maxLength={500} disabled={pending} description="For example, not enough instructors today. Avoid personal or medical details." />
        {feedback.message ? <div ref={summaryRef} tabIndex={-1}><Notice tone="error" live="alert" title={feedback.message} /></div> : null}
        <DialogFooter><Button variant="outline" type="button" className="min-h-11" disabled={pending} onClick={() => setOpen(false)}>Keep class</Button><LoadingButton type="submit" className="min-h-11" pending={pending} pendingLabel="Merging…">Merge class</LoadingButton></DialogFooter>
      </form></FormFeedbackProvider>
    </DialogContent>
  </Dialog>;
}

export function UndoMerge({ course, disabled }: { course: DutyClass; disabled?: boolean }) {
  const [open, setOpen] = useState(false), [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null), router = useRouter();
  if (!course.mergedInto) return null;
  const merge = course.mergedInto;
  return <Dialog open={open} onOpenChange={value => { if (!pending) { setOpen(value); setError(null); } }}>
    <DialogTrigger asChild><Button variant="outline" disabled={disabled} aria-label={`Undo merge: ${course.name}, ${formatTime(course.startMinutes)}`}><Undo2 aria-hidden="true" /><span className="pc-only-wide">Undo merge</span></Button></DialogTrigger>
    <DialogContent showCloseButton={false}>
      <DialogHeader><DialogTitle>Undo this merge?</DialogTitle><DialogDescription>{course.name} · merged into {merge.name} at {formatTime(merge.startMinutes)}</DialogDescription></DialogHeader>
      <p className="text-sm">The class runs as usual today, and its swimmers leave the other register. This is only possible before any of them has been marked there.</p>
      {error ? <Notice tone="error" live="alert" title={error} /> : null}
      <DialogFooter><Button variant="outline" className="min-h-11" disabled={pending} onClick={() => setOpen(false)}>Keep merge</Button><LoadingButton className="min-h-11" pending={pending} pendingLabel="Undoing…" onClick={() => startTransition(async () => {
        setError(null);
        try {
          const result = await withTimeout(undoClassMerge({ mergeId: merge.id }));
          if (!result.ok) { setError(result.error); return; }
          setOpen(false); toast.success("Merge undone. The class runs as usual."); router.refresh();
        } catch { setError(SAVE_UNCONFIRMED_MESSAGE); }
      })}>Undo merge</LoadingButton></DialogFooter>
    </DialogContent>
  </Dialog>;
}
