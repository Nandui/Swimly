"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/ui/loading-button";
import { FormFeedbackProvider, useFormFeedback } from "@/components/ui/form-feedback";
import { cancelClassSession } from "@/lib/cancellations/actions";
import { formatDate, parseDateOnly } from "@/lib/format";
import { formatTime } from "@/lib/courses/constants";
import type { DutyClass } from "@/lib/duty/data";
import { SAVE_UNCONFIRMED_MESSAGE, withTimeout } from "@/lib/save-feedback";

export function CancelSession({ course, date, disabled }: { course: DutyClass; date: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const { formRef, summaryRef, ...feedback } = useFormFeedback();
  const router = useRouter();
  return <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value); }}>
    <DialogTrigger asChild><Button variant="outline" className="min-h-11" disabled={disabled} aria-label={`Cancel session: ${course.name}, ${formatTime(course.startMinutes)}`}>Cancel session</Button></DialogTrigger>
    <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Cancel this session?</DialogTitle><DialogDescription>{course.name} · {formatDate(parseDateOnly(date))} · {formatTime(course.startMinutes)}–{formatTime(course.startMinutes + course.durationMinutes)}</DialogDescription></DialogHeader>
      <p className="text-sm">This cancels today’s session only. The weekly class and enrolments stay in place. The affected swimmers will be added to the billing follow-up list.</p>
      {course.started || course.attendanceRecorded > 0 ? <p className="rounded-ui-md border border-ui-border bg-ui-muted p-3 text-sm">This class has already been started or has attendance recorded. Those records will be kept, and further teaching saves will be blocked.</p> : null}
      <FormFeedbackProvider feedback={feedback}><form ref={formRef} className="space-y-4" onSubmit={event => {
        event.preventDefault();
        if (pending) return;
        startTransition(async () => {
          feedback.reset();
          try {
            const result = await withTimeout(cancelClassSession({ courseId: course.id, date, reason }));
            if (!result.ok) { feedback.report(result); return; }
            setOpen(false); setReason(""); toast.success("Session cancelled. Added to billing follow-up."); router.refresh();
          } catch { feedback.report(SAVE_UNCONFIRMED_MESSAGE); }
        });
      }}>
        <Textarea label="Reason for cancellation" name="reason" value={reason} onChange={event => setReason(event.target.value)} required maxLength={500} disabled={pending} description="Keep this about the class; avoid personal or medical details." />
        {feedback.message ? <div ref={summaryRef} role="alert" tabIndex={-1} className="text-sm text-ui-destructive">{feedback.message}</div> : null}
        <DialogFooter><Button variant="outline" type="button" className="min-h-11" disabled={pending} onClick={() => setOpen(false)}>Keep session</Button><LoadingButton type="submit" className="min-h-11" variant="destructive" pending={pending} pendingLabel="Cancelling…">Confirm cancellation</LoadingButton></DialogFooter>
      </form></FormFeedbackProvider>
    </DialogContent>
  </Dialog>;
}
