"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/ui/loading-button";
import { FormFeedbackProvider, useFormFeedback } from "@/components/ui/form-feedback";
import { Notice } from "@/components/ui-kit/notice";
import { cancelClassSession } from "@/modules/activities/lib/cancellations/actions";
import { CalendarX2 } from "lucide-react";
import { formatDate, formatTime, formatTimeRange, parseDateOnly } from "@/lib/format";
import type { DutyClass } from "@/modules/activities/lib/duty/data";
import { SAVE_UNCONFIRMED_MESSAGE, withTimeout } from "@/lib/save-feedback";

export function CancelSession({ course, date, disabled }: { course: DutyClass; date: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const { formRef, summaryRef, ...feedback } = useFormFeedback();
  const router = useRouter();
  return <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value); }}>
    <DialogTrigger asChild><Button variant="outline" disabled={disabled} aria-label={`Cancel session: ${course.name}, ${formatTime(course.startMinutes)}`}><CalendarX2 aria-hidden="true" /><span className="pc-only-wide">Cancel session</span></Button></DialogTrigger>
    <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Cancel this session?</DialogTitle><DialogDescription>{course.name} · {formatDate(parseDateOnly(date))} · {formatTimeRange(course.startMinutes, course.startMinutes + course.durationMinutes)}</DialogDescription></DialogHeader>
      <p className="text-sm">This cancels today’s session only. The weekly class and enrolments stay in place. The affected swimmers will be added to the billing follow-up list.</p>
      {course.started || course.attendanceRecorded > 0 ? <Notice tone="warning" title="This class has already been started or has attendance recorded." description="Those records will be kept, and further teaching saves will be blocked." /> : null}
      <FormFeedbackProvider feedback={feedback}><form ref={formRef} method="post" className="space-y-4" onSubmit={event => {
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
        {feedback.message ? <div ref={summaryRef} tabIndex={-1}><Notice tone="error" live="alert" title={feedback.message} /></div> : null}
        <DialogFooter><Button variant="outline" type="button" className="min-h-11" disabled={pending} onClick={() => setOpen(false)}>Keep session</Button><LoadingButton type="submit" className="min-h-11" variant="destructive" pending={pending} pendingLabel="Cancelling…">Confirm cancellation</LoadingButton></DialogFooter>
      </form></FormFeedbackProvider>
    </DialogContent>
  </Dialog>;
}
