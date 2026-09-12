"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
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
import { startClass } from "@/lib/attendance/actions/cover";
import { withTimeout, SAVE_UNCONFIRMED_MESSAGE } from "@/lib/save-feedback";
import { TeachingNotice } from "./teaching-ui";

export function StartClass({
  courseId,
  date,
  name,
  schedule,
  instructorName,
  own,
  href,
}: {
  courseId: string;
  date: string;
  name: string;
  schedule: string;
  instructorName: string | null;
  own: boolean;
  href: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function confirm() {
    startTransition(async () => {
      try {
        const result = await withTimeout(startClass({ courseId, date }));
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setOpen(false);
        setError(null);
        router.push(href);
        router.refresh();
      } catch {
        setError(SAVE_UNCONFIRMED_MESSAGE);
      }
    });
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value);
          if (!value) setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          className="min-h-11"
          aria-label={`Start class: ${name}, ${schedule}`}
        >
          <Play aria-hidden="true" />
          Start class
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Start {name}?</DialogTitle>
          <DialogDescription>
            {schedule}
            {!own && instructorName
              ? ` · Scheduled instructor: ${instructorName}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm leading-relaxed">
          Confirm you are at the pool and teaching this class. It will be yours
          for this session, and other instructors will not be able to open it.
        </p>
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
          <Button className="min-h-11" disabled={pending} onClick={confirm}>
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
            {pending ? "Starting…" : "Confirm and start"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
