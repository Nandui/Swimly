"use client";

import * as React from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Every form dialog in the app, so the failure behaviour is written once.
 *
 *  Failure keeps the dialog open with the sentence beside the fields; success
 *  closes it and confirms with a toast. Never the reverse — a toast reporting
 *  a validation failure after the dialog has closed has thrown away the
 *  typing.
 *
 *  The `startTransition` around `setOpen`/`setError` is not decoration: in
 *  React 19.2 a state update made *after* an `await` inside a transition is no
 *  longer part of it, so without the wrapper the dialog closes outside the
 *  pending state and flashes. The toast needs no such wrapper. */
export function FormDialog({
  trigger,
  title,
  description,
  submitLabel = "Save",
  successMessage,
  submit,
  width = "sm:max-w-md",
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  submitLabel?: string;
  successMessage: string;
  submit: (formData: FormData) => Promise<ActionResult>;
  /** Widen for a form with two columns of fields. */
  width?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await submit(formData);
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={cn("max-h-[85svh] overflow-y-auto", width)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>

          <div className="space-y-3">{children}</div>

          {error ? (
            <p
              role="alert"
              className="rounded bg-(--tag-red-bg) px-2.5 py-1.5 text-[13px] text-(--tag-red-fg)"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A labelled field. 13px medium label over the control, per the type scale. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
