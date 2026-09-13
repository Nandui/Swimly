"use client";
import { Notice } from "@/components/ui-kit/notice";
import { Button } from "@/components/shadcn/button";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserRoundCheck } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";

import { takeOverClass } from "@/lib/attendance/actions/cover";
import { toast } from "@/lib/toast";

/** The question asked when somebody opens a class that is not theirs: are
 *  you taking it? Asked once, up front, because the answer changes what the
 *  register will say about the day — and asked again by the button in the
 *  notice, for anyone who said no and then found themselves in the water.
 *
 *  Somebody who may mark any register is asked too: the question is about
 *  who conducted the class, not about permission. They get a third answer,
 *  "just recording it", for the desk copying in a paper sheet. */
export function TakeOver({
  courseId,
  date,
  classLabel,
  dateLabel,
  instructorName,
  mayMarkAnyway,
  autoOpen,
}: {
  courseId: string;
  date: string;
  classLabel: string;
  dateLabel: string;
  instructorName: string | null;
  /** They can already mark it, so the notice is not shown and "no" costs nothing. */
  mayMarkAnyway: boolean;
  autoOpen: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  // Once answered on this device the question stays answered for the day;
  // "no, just looking" is not remembered, so a reload asks again.
  const storageKey = `swimly:cover-asked:${courseId}:${date}`;

  React.useEffect(() => {
    if (!autoOpen) return;
    try {
      if (window.localStorage.getItem(storageKey)) return;
    } catch {
      // Storage blocked: ask every time, which is the safe direction.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [autoOpen, storageKey]);

  function remember() {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Then it asks again next time. Fine.
    }
  }

  function confirm() {
    startTransition(async () => {
      const result = await takeOverClass({ courseId, date });
      if (result.ok) {
        remember();
        toast.success(`${classLabel} is yours for ${dateLabel}`);
        startTransition(() => setOpen(false));
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const whose = instructorName
    ? `${instructorName}'s class`
    : "nobody's class in particular";

  return (
    <>
      {mayMarkAnyway ? null : (
        <Notice
          title={`This is ${whose}.`}
          description="You can read it, and mark it once you have taken it over."
          tone="warning"
          actions={
            <Button
              type="button"
              onClick={() => setOpen(true)}
              variant="outline"
              size="sm"
            >
              {
                <UserRoundCheck
                  aria-hidden={true}
                  className="size-4 shrink-0"
                />
              }
              {"Take over this class"}
            </Button>
          }
        ></Notice>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <DialogContent
          showCloseButton={!pending}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
          aria-busy={pending}
        >
          <div className="min-w-0 flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Taking over {classLabel}?</DialogTitle>
              <DialogDescription>
                Confirm who is teaching this lesson.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-ui-foreground block">
              {instructorName
                ? `It is ${instructorName}'s class.`
                : "Nobody is assigned to it."}{" "}
              Say yes, and the record for {dateLabel} says you took this class
              {instructorName ? `, not ${instructorName}` : ""}. Competencies
              you mark carry your name too.
            </p>
            <div
              className={
                "min-w-0 flex gap-2 items-center justify-end flex-wrap"
              }
            >
              <Button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                variant="outline"
              >
                {mayMarkAnyway ? "Cancel" : "No, just looking"}
              </Button>
              {mayMarkAnyway && instructorName ? (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    remember();
                    setOpen(false);
                  }}
                  variant="outline"
                >{`Just recording it for ${instructorName}`}</Button>
              ) : null}
              <Button
                type="button"
                onClick={confirm}
                variant="default"
                disabled={pending}
                aria-busy={pending}
              >
                {pending ? "Working…" : "Yes, I am taking it"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
