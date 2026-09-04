"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserRoundCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { takeOverClass } from "@/lib/attendance/actions/cover";

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

  const whose = instructorName ? `${instructorName}'s class` : "nobody's class in particular";

  return (
    <>
      {mayMarkAnyway ? null : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded bg-(--tag-yellow-bg) px-2.5 py-1.5 text-[13px] text-(--tag-yellow-fg)">
          <p>This is {whose}. You can read it, and mark it once you have taken it over.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            <UserRoundCheck className="size-4" />
            Take over this class
          </Button>
        </div>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taking over {classLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              {instructorName ? `It is ${instructorName}'s class.` : "Nobody is assigned to it."}{" "}
              Say yes, and the record for {dateLabel} says you took this class
              {instructorName ? `, not ${instructorName}` : ""}. Competencies you mark carry your
              name too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" size="sm">
                {mayMarkAnyway ? "Cancel" : "No, just looking"}
              </Button>
            </AlertDialogCancel>
            {mayMarkAnyway && instructorName ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  remember();
                  setOpen(false);
                }}
              >
                Just recording it for {instructorName}
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={confirm} disabled={pending}>
              {pending ? "Working…" : "Yes, I am taking it"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
