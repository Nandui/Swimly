"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/ui/loading-button";
import { FormFeedbackProvider, useFormFeedback } from "@/components/ui/form-feedback";
import { Tag } from "@/components/ui-kit/tag";
import { CANCELLATION_META } from "@/lib/cancellations/constants";
import { markBillingNotified } from "@/lib/cancellations/actions";
import { formatTime } from "@/lib/courses/constants";
import { formatDate, parseDateOnly } from "@/lib/format";
import { SAVE_UNCONFIRMED_MESSAGE, withTimeout } from "@/lib/save-feedback";

export type BillingCancellation = {
  id: string; courseId: string; date: string; className: string; startMinutes: number; durationMinutes: number;
  programmeName: string; location: string | null; instructorName: string | null; reason: string;
  cancelledByName: string; cancelledAt: string; attendanceRecorded: number; billingNotifiedAt: string | null;
  billingNotifiedByName: string | null; billingNote: string | null;
  swimmers: { studentId: string; swimmerName: string; memberNumber: string | null }[];
};

export function BillingReview({ row, canNotify }: { row: BillingCancellation; canNotify: boolean }) {
  const [open, setOpen] = useState(false), [note, setNote] = useState("");
  const [pending, startTransition] = useTransition(), router = useRouter();
  const { formRef, summaryRef, ...feedback } = useFormFeedback();
  const meta = row.billingNotifiedAt ? CANCELLATION_META.notified : CANCELLATION_META.pending;
  return <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value); }}><DialogTrigger asChild><Button variant="outline" className="min-h-11" aria-label={`Review cancellation: ${row.className}, ${formatDate(parseDateOnly(row.date))}, ${formatTime(row.startMinutes)}`}>Review cancellation</Button></DialogTrigger>
    <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{row.className}</DialogTitle><DialogDescription>{formatDate(parseDateOnly(row.date))} · {formatTime(row.startMinutes)}–{formatTime(row.startMinutes + row.durationMinutes)} · {row.location || "Pool area not set"}</DialogDescription></DialogHeader>
      <div className="space-y-3"><Tag color={meta.color}>{meta.label}</Tag><p className="text-sm whitespace-pre-wrap break-words">{row.reason}</p><p className="text-xs text-ui-muted-foreground">Cancelled by {row.cancelledByName} · {formatDate(new Date(row.cancelledAt))}</p>{row.attendanceRecorded ? <p className="rounded-ui-md bg-ui-muted p-3 text-sm">{row.attendanceRecorded} attendance records already existed. Check these before deciding on a billing change.</p> : null}</div>
      <section><h3 className="mb-2 text-sm font-semibold">Affected swimmers · {row.swimmers.length}</h3><p className="mb-2 text-xs text-ui-muted-foreground">Enrolled when the session was cancelled.</p><ul className="divide-y divide-ui-border">{row.swimmers.map(swimmer => <li key={swimmer.studentId} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{swimmer.swimmerName}</span><span className="text-ui-muted-foreground">{swimmer.memberNumber || "No member number"}</span></li>)}</ul>{!row.swimmers.length ? <p className="text-sm text-ui-muted-foreground">No swimmers were enrolled.</p> : null}</section>
      {row.billingNotifiedAt ? <div className="space-y-1 rounded-ui-md border border-ui-border p-3 text-sm"><p className="font-medium">Billing notified by {row.billingNotifiedByName} · {formatDate(new Date(row.billingNotifiedAt))}</p><p className="whitespace-pre-wrap break-words">{row.billingNote}</p></div> : null}
      <FormFeedbackProvider feedback={feedback}><form ref={formRef} className="space-y-4" onSubmit={event => {
        event.preventDefault(); if (pending) return;
        startTransition(async () => {
          feedback.reset();
          try {
            const result = await withTimeout(markBillingNotified({ courseId: row.courseId, cancellationId: row.id, note }));
            if (!result.ok) { feedback.report(result); return; }
            setOpen(false); setNote(""); toast.success("Billing notification recorded."); router.refresh();
          } catch { feedback.report(SAVE_UNCONFIRMED_MESSAGE); }
        });
      }}>
        {canNotify && !row.billingNotifiedAt ? <Textarea label="Billing handoff note" name="note" value={note} onChange={event => setNote(event.target.value)} required maxLength={500} disabled={pending} description="After notifying billing, record who you contacted and how. This saves the handoff; it does not send a message or change a bill." /> : null}
        {feedback.message ? <div ref={summaryRef} role="alert" tabIndex={-1} className="text-sm text-ui-destructive">{feedback.message}</div> : null}
        <DialogFooter><Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => setOpen(false)}>Close</Button>{canNotify && !row.billingNotifiedAt ? <LoadingButton type="submit" className="min-h-11" pending={pending} pendingLabel="Recording…">Mark billing notified</LoadingButton> : null}</DialogFooter>
      </form></FormFeedbackProvider>
    </DialogContent>
  </Dialog>;
}
