"use client";

import * as React from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import type { ActionResult } from "@/lib/action-result";
import { toast } from "@/lib/toast";
import { withTimeout } from "@/lib/save-feedback";
import { Trigger } from "@/components/form-dialog";

/** Confirmation for anything that takes something away.
 *
 *  The description is where you are honest about consequences — what is lost
 *  and what survives — because that is what someone is actually choosing
 *  between. The error is rendered in place rather than thrown at a toast,
 *  since a refusal ("three courses still teach this level") is a sentence the
 *  person can act on.
 *
 *  Astryx's own AlertDialog takes a plain-string description; this one keeps
 *  a Dialog so a consequence can carry a name in bold. */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  successMessage,
  destructive = false,
  run,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  successMessage: string;
  destructive?: boolean;
  run: () => Promise<ActionResult>;
}) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const submitting = React.useRef(false);

  function close() {
    if (submitting.current) return;
    setOpen(false);
    setError(null);
  }

  function handleConfirm() {
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await withTimeout(run());
        if (result.ok) {
          toast.success(successMessage);
          startTransition(() => {
            setOpen(false);
            setError(null);
          });
        } else {
          startTransition(() => setError(result.error));
        }
      } catch {
        startTransition(() =>
          setError("We could not confirm the change. Check the record before trying again.")
        );
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <>
      <Trigger onOpen={() => setOpen(true)}>{trigger}</Trigger>
      <Dialog
        isOpen={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        purpose={pending ? "required" : "form"}
        width={448}
      >
        <VStack gap={4}>
          <DialogHeader title={title} onOpenChange={pending ? undefined : close} />
          <Text as="p" display="block">
            {description}
          </Text>
          {error ? <Banner status="error" title={error} collapsible={false} /> : null}
          <HStack gap={2} hAlign="end" wrap="wrap">
            <Button type="button" label="Cancel" variant="secondary" onClick={close} isDisabled={pending} />
            <Button
              type="button"
              label={pending ? "Working…" : confirmLabel}
              variant={destructive ? "destructive" : "primary"}
              onClick={handleConfirm}
              isLoading={pending}
            />
          </HStack>
        </VStack>
      </Dialog>
    </>
  );
}

/** A bare action button that calls a server action and reports the outcome.
 *  For the small, obvious moves — reordering a level, restoring an archived
 *  row — where a confirmation would be ceremony. */
export function ActionButton({
  children,
  run,
  successMessage,
  className,
  ariaLabel,
  title,
}: {
  children: React.ReactNode;
  run: () => Promise<ActionResult>;
  successMessage?: string;
  className?: string;
  ariaLabel: string;
  title?: string;
}) {
  return (
    <IconButton
      label={ariaLabel}
      tooltip={title ?? ariaLabel}
      variant="ghost"
      size="sm"
      icon={children}
      className={className}
      clickAction={async () => {
        try {
          const result = await withTimeout(run());
          if (result.ok) {
            if (successMessage) toast.success(successMessage);
          } else {
            toast.error(result.error);
          }
        } catch {
          toast.error("We could not confirm the change. Check the record before trying again.");
        }
      }}
    />
  );
}
