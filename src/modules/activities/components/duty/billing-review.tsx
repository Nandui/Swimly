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
import { Notice } from "@/components/ui-kit/notice";
import { CANCELLATION_META } from "@/modules/activities/lib/cancellations/constants";
import { markBillingNotified } from "@/modules/activities/lib/cancellations/actions";
import { formatDate, formatTime, formatTimeRange, parseDateOnly, plural } from "@/lib/format";
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
    <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{row.className}</DialogTitle><DialogDescription>{formatDate(parseDateOnly(row.date))} · {formatTimeRange(row.startMinutes, row.startMinutes + row.durationMinutes)} · {row.location || "Pool area not set"}</DialogDescription></DialogHeader>
      <div className="space-y-3"><Tag meta={meta} /><p className="text-sm whitespace-pre-wrap break-words">{row.reason}</p><p className="text-xs text-ui-muted-foreground">Cancelled by {row.cancelledByName} · {formatDate(new Date(row.cancelledAt))}</p>{row.attendanceRecorded ? <Notice tone="warning" title={`${plural(row.attendanceRecorded, "attendance record")} already existed.`} description="Check these before deciding on a billing change." /> : null}</div>
      {row.billingNotifiedAt ? <section className="flex min-w-0 flex-col gap-1"><h3 className="text-sm font-semibold">Billing notified</h3><p className="text-xs text-ui-muted-foreground">{row.billingNotifiedByName ? `By ${row.billingNotifiedByName} · ` : ""}{formatDate(new Date(row.billingNotifiedAt))}</p>{row.billingNote ? <p className="text-sm whitespace-pre-wrap break-words">{row.billingNote}</p> : null}</section> : null}
      <section className="flex flex-col gap-2"><h3 className="text-sm font-semibold">Affected swimmers · {row.swimmers.length}</h3><p className="text-xs text-ui-muted-foreground">Enrolled when the session was cancelled.</p>{row.swimmers.length ? <ul className="pc-rows">{row.swimmers.map(swimmer => <li key={swimmer.studentId} className="pc-row"><div className="pc-row-body"><span className="pc-row-title">{swimmer.swimmerName}</span>{swimmer.memberNumber ? <span className="pc-row-hint">#{swimmer.memberNumber}</span> : null}</div></li>)}</ul> : <p className="text-sm text-ui-muted-foreground">No swimmers were enrolled.</p>}</section>
      <FormFeedbackProvider feedback={feedback}><form ref={formRef} method="post" className="space-y-4" onSubmit={event => {
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
        {feedback.message ? <div ref={summaryRef} tabIndex={-1}><Notice tone="error" live="alert" title={feedback.message} /></div> : null}
        <DialogFooter><Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => setOpen(false)}>Close</Button>{canNotify && !row.billingNotifiedAt ? <LoadingButton type="submit" className="min-h-11" pending={pending} pendingLabel="Recording…">Mark billing notified</LoadingButton> : null}</DialogFooter>
      </form></FormFeedbackProvider>
    </DialogContent>
  </Dialog>;
}
