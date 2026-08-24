"use client";

import * as React from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Confirmation for anything that takes something away.
 *
 *  The description is where you are honest about consequences — what is lost
 *  and what survives — because that is what someone is actually choosing
 *  between. The error is rendered in place rather than thrown at a toast,
 *  since a refusal ("three courses still teach this level") is a sentence the
 *  person can act on. */
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

  function handleConfirm() {
    startTransition(async () => {
      const result = await run();
      if (result.ok) {
        toast.success(successMessage);
        startTransition(() => {
          setError(null);
          setOpen(false);
        });
      } else {
        startTransition(() => setError(result.error));
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <p
            role="alert"
            className="rounded bg-(--tag-red-bg) px-2.5 py-1.5 text-[13px] text-(--tag-red-fg)"
          >
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </AlertDialogCancel>
          <Button
            type="button"
            size="sm"
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      className={className}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await run();
          if (result.ok) {
            if (successMessage) toast.success(successMessage);
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      {children}
    </Button>
  );
}
