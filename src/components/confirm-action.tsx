"use client";

import * as React from "react";
import { Button } from "@/components/shadcn/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog";
import { Notice } from "@/components/ui-kit/notice";
import type { ActionResult } from "@/lib/action-result";
import { toast } from "@/lib/toast";
import { withTimeout } from "@/lib/save-feedback";
import { Trigger, useDialogTriggerFocus } from "@/components/form-dialog";

/** Errors keep the confirmation open; only a confirmed successful action closes it. */
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
  const rememberTrigger = useDialogTriggerFocus(open);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const submitting = React.useRef(false);
  function close() {
    if (!submitting.current) {
      setOpen(false);
      setError(null);
    }
  }
  function confirm() {
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
        } else startTransition(() => setError(result.error));
      } catch {
        startTransition(() =>
          setError(
            "We could not confirm the change. Check the record before trying again.",
          ),
        );
      } finally {
        submitting.current = false;
      }
    });
  }
  return (
    <>
      <Trigger
        onOpen={(element) => {
          rememberTrigger(element);
          setOpen(true);
        }}
      >
        {trigger}
      </Trigger>
      <AlertDialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <AlertDialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
          aria-busy={pending}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>{description}</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <Notice tone="error" title={error} /> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant={destructive ? "destructive" : "default"}
              disabled={pending}
              onClick={confirm}
            >
              {pending ? "Working…" : confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Audited server actions keep their duplicate-submit and timeout protection. */
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
  const [pending, startTransition] = React.useTransition();
  const submitting = React.useRef(false);
  return (
    <Button
      type="button"
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      variant="ghost"
      size="icon-sm"
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        if (submitting.current) return;
        submitting.current = true;
        startTransition(async () => {
          try {
            const result = await withTimeout(run());
            if (result.ok) {
              if (successMessage) toast.success(successMessage);
            } else toast.error(result.error);
          } catch {
            toast.error(
              "We could not confirm the change. Check the record before trying again.",
            );
          } finally {
            submitting.current = false;
          }
        });
      }}
    >
      {children}
    </Button>
  );
}
