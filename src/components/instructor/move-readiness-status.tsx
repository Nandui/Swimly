"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { Tag } from "@/components/ui-kit/tag";
import { FOLLOW_UP_META } from "@/lib/enrolment/constants";
import { formatDate } from "@/lib/format";
import { cancelInstructorMoveReadiness } from "@/lib/progression/actions/assess";
import { SAVE_UNCONFIRMED_MESSAGE, withTimeout } from "@/lib/save-feedback";
import { toast } from "@/lib/toast";
import { TeachingNotice } from "./teaching-ui";

export function MoveReadinessStatus({ studentId, studentName, courseId, date, current, confirmedBy, confirmedAt }: {
  studentId: string; studentName: string; courseId: string; date: string; current: boolean; confirmedBy: string | null; confirmedAt: Date;
}) {
  const [open, setOpen] = useState(false), [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const meta = FOLLOW_UP_META[current ? "readyToMove" : "reviewMove"];
  return <div className="flex flex-wrap items-center gap-3">
    <div className="space-y-1">
      <Tag color={meta.color}>{current ? "Awaiting move" : meta.label}</Tag>
      <p className="text-xs text-ui-muted-foreground">{confirmedBy ?? "Staff"} · {formatDate(confirmedAt)}</p>
    </div>
    <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value); }}>
      <DialogTrigger asChild><Button variant="ghost" className="min-h-11" aria-label={`Remove ${studentName} from awaiting moves`}>Undo readiness</Button></DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader><DialogTitle>Remove {studentName} from awaiting moves?</DialogTitle>
          <DialogDescription>Their competencies and level completion stay recorded. You can mark them ready again later.</DialogDescription></DialogHeader>
        {error ? <TeachingNotice title={error} error /> : null}
        <DialogFooter>
          <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => setOpen(false)}>Keep on list</Button>
          <LoadingButton className="min-h-11" pending={pending} onClick={() => startTransition(async () => {
            try {
              const result = await withTimeout(cancelInstructorMoveReadiness({ studentId, teaching: { courseId, date } }));
              if (!result.ok) { setError(result.error); return; }
              setError(null); setOpen(false); toast.success("Removed from awaiting moves");
            } catch { setError(SAVE_UNCONFIRMED_MESSAGE); }
          })}>Remove from list</LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
