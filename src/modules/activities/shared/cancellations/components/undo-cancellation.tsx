"use client";

import { useRouter } from "next/navigation";
import { CalendarCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { ConfirmAction } from "@/components/confirm-action";
import { formatDate, formatTime, parseDateOnly } from "@/lib/format";
import { undoCancellation, undoClosure } from "@/modules/activities/shared/cancellations/actions";

/** Puts one cancelled session back, while billing has not acted on it and it has not started. */
export function UndoCancellation({ cancellationId, className, date, startMinutes }: { cancellationId: string; className: string; date: string; startMinutes: number }) {
  const router = useRouter();
  return <ConfirmAction
    trigger={<Button variant="outline" aria-label={`Undo cancellation: ${className}, ${formatTime(startMinutes)}`}><Undo2 aria-hidden="true" /><span className="pc-only-wide">Undo cancellation</span></Button>}
    title="Put this session back on?"
    description={`${className} on ${formatDate(parseDateOnly(date))} at ${formatTime(startMinutes)} runs as planned again, and leaves the billing follow-up list.`}
    confirmLabel="Undo cancellation" successMessage="Cancellation undone. The session runs as planned."
    run={async () => { const result = await undoCancellation({ cancellationId }); if (result.ok) router.refresh(); return result; }} />;
}

/** Reopens a closed day: every class in the closure that can still be put back. */
export function ReopenDay({ closureId, date, count }: { closureId: string; date: string; count: number }) {
  const router = useRouter();
  return <ConfirmAction
    trigger={<Button variant="outline"><CalendarCheck aria-hidden="true" />Reopen the day</Button>}
    title="Reopen this day?"
    description={`The ${count === 1 ? "class" : `${count} classes`} closed on ${formatDate(parseDateOnly(date))} run as planned again and leave the billing follow-up list. Any class billing has already acted on, or that has started, stays cancelled.`}
    confirmLabel="Reopen the day" successMessage="Day reopened. Its classes run as planned."
    run={async () => { const result = await undoClosure({ closureId }); router.refresh(); return result; }} />;
}
