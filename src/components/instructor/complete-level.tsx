"use client";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shadcn/dialog";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import { confirmLevelCompletion } from "@/lib/progression/actions/assess";
import { withTimeout, SAVE_UNCONFIRMED_MESSAGE } from "@/lib/save-feedback";
import { toast } from "@/lib/toast";
import { TeachingNotice } from "./teaching-ui";

export function CompleteLevel({
  studentId,
  studentName,
  levelId,
  levelName,
  courseId,
  date,
  disabled = false,
}: {
  studentId: string;
  studentName: string;
  levelId: string;
  levelName: string;
  courseId: string;
  date: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [note, setNote] = useState(""),
    [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={disabled}
          aria-label={`Mark ${studentName} ready to move`}
        >
          Ready to move
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Mark {studentName} ready to move?</DialogTitle>
          <DialogDescription>
            Every competency in {levelName} is achieved. This confirms the level
            completion and adds {studentName} to Awaiting moves for reception.
            They stay in this class until staff arrange the move.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`completion-note-${studentId}`}>
            Note for reception (optional)
          </Label>
          <Textarea
            id={`completion-note-${studentId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            disabled={pending}
          />
        </div>
        {error ? <TeachingNotice title={error} error /> : null}
        <DialogFooter>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <LoadingButton
            className="min-h-11"
            pending={pending}
            onClick={() =>
              startTransition(async () => {
                // The checklist mirrors unsaved edits on this device. Never
                // hand off a swimmer while their local marks still differ.
                try {
                  const draft = JSON.parse(localStorage.getItem(`swimly:assess:${courseId}:${date}`) ?? "null");
                  if (draft?.[studentId] && Object.keys(draft[studentId]).length) {
                    setError("Save this swimmer’s competency changes before confirming readiness.");
                    return;
                  }
                } catch { /* Server eligibility remains authoritative if storage is unavailable. */ }
                try {
                  const result = await withTimeout(
                    confirmLevelCompletion({
                      studentId,
                      levelId,
                      note,
                      overrideReason: "",
                      teaching: { courseId, date },
                      readyToMove: true,
                    }),
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                  setError(null);
                  toast.success("Added to awaiting moves");
                } catch {
                  setError(SAVE_UNCONFIRMED_MESSAGE);
                }
              })
            }
          >
            <Check aria-hidden="true" />
            Confirm ready to move
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
