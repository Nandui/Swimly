"use client";
import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
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
}: {
  studentId: string;
  studentName: string;
  levelId: string;
  levelName: string;
  courseId: string;
  date: string;
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
          aria-label={`Complete ${levelName} for ${studentName}`}
        >
          Complete level
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Complete {levelName}?</DialogTitle>
          <DialogDescription>
            {studentName} has achieved every competency. Confirm they are ready
            to complete this level.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`completion-note-${studentId}`}>
            Note (optional)
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
          <Button
            className="min-h-11"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const result = await withTimeout(
                    confirmLevelCompletion({
                      studentId,
                      levelId,
                      note,
                      overrideReason: "",
                      teaching: { courseId, date },
                    }),
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                  setError(null);
                  toast.success("Level completed");
                } catch {
                  setError(SAVE_UNCONFIRMED_MESSAGE);
                }
              })
            }
          >
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
            Confirm completion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
