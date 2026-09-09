"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserRoundCheck } from "lucide-react";
import { Banner } from "@/components/workspace/feedback";
import { Button } from "@/components/workspace/actions";
import { Dialog, DialogHeader } from "@/components/workspace/overlays";
import { HStack, VStack } from "@/components/workspace/layout";
import { Text } from "@/components/workspace/typography";
import { takeOverClass } from "@/lib/attendance/actions/cover";
import { toast } from "@/lib/toast";
import { Icon } from "@/components/workspace/misc";

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
        <Banner
          status="warning"
          title={`This is ${whose}.`}
          description="You can read it, and mark it once you have taken it over."
          collapsible={false}
          endContent={
            <Button
              type="button"
              label="Take over this class"
              variant="secondary"
              size="sm"
              icon={<Icon icon={UserRoundCheck} size="sm" />}
              onClick={() => setOpen(true)}
            />
          }
        />
      )}

      <Dialog isOpen={open} onOpenChange={setOpen} purpose="form" width={448}>
        <VStack gap={4}>
          <DialogHeader title={`Taking over ${classLabel}?`} onOpenChange={setOpen} />
          <Text as="p" display="block">
            {instructorName ? `It is ${instructorName}'s class.` : "Nobody is assigned to it."}{" "}
            Say yes, and the record for {dateLabel} says you took this class
            {instructorName ? `, not ${instructorName}` : ""}. Competencies you mark carry your
            name too.
          </Text>
          <HStack gap={2} hAlign="end" wrap="wrap">
            <Button
              type="button"
              label={mayMarkAnyway ? "Cancel" : "No, just looking"}
              variant="secondary"
              onClick={() => setOpen(false)}
            />
            {mayMarkAnyway && instructorName ? (
              <Button
                type="button"
                label={`Just recording it for ${instructorName}`}
                variant="secondary"
                onClick={() => {
                  remember();
                  setOpen(false);
                }}
              />
            ) : null}
            <Button
              type="button"
              label={pending ? "Working…" : "Yes, I am taking it"}
              variant="primary"
              onClick={confirm}
              isLoading={pending}
            />
          </HStack>
        </VStack>
      </Dialog>
    </>
  );
}
