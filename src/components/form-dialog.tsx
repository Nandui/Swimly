"use client";

import * as React from "react";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Notice } from "@/components/ui-kit/notice";
import { FieldFrame } from "@/components/ui/field-frame";
import { cn } from "@/lib/utils";
import styles from "./form-dialog.module.css";
import type {
  ActionResult,
  ActionConfirmation,
  ConfirmationReply,
} from "@/lib/action-result";
import { toast } from "@/lib/toast";
import { withTimeout } from "@/lib/save-feedback";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SearchablePicker } from "@/components/searchable-picker";
import { StudentPicker } from "@/components/students/student-search";

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
  onOpen,
  onSuccess,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  submitLabel?: string;
  successMessage: string;
  submit: (
    formData: FormData,
    confirmation?: ConfirmationReply,
  ) => Promise<ActionResult>;
  /** Widen for a form with two columns of fields. */
  width?: string;
  children: React.ReactNode;
  onOpen?: () => void;
  /** Complete an inline workflow after its dialog has saved successfully. */
  onSuccess?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const rememberTrigger = useDialogTriggerFocus(open);
  const [error, setError] = React.useState<string | null>(null);
  const errorMessage = React.useRef<HTMLDivElement>(null);
  const [pending, startTransition] = React.useTransition();
  const submitting = React.useRef(false);
  const [confirmation, setConfirmation] = React.useState<{
    prompt: ActionConfirmation;
    data: FormData;
  } | null>(null);
  const confirmationHeading = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
  }, [confirmation]);
  React.useEffect(() => {
    if (error) errorMessage.current?.focus();
  }, [error]);

  function openForm(triggerElement?: HTMLElement) {
    // Mount fresh controls when opened. Failed saves leave the dialog mounted
    // so input survives; closed dialogs do not retain duplicate field IDs.
    if (!open) {
      rememberTrigger(triggerElement);
      onOpen?.();
    }
    setOpen(true);
  }

  function close() {
    if (submitting.current) return;
    setOpen(false);
    setError(null);
    setConfirmation(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const formData = new FormData(event.currentTarget);
    if (confirmation) return;
    save(formData);
  }

  function save(formData: FormData, reply?: ConfirmationReply) {
    if (submitting.current) return;
    submitting.current = true;
    setError(null);

    startTransition(async () => {
      try {
        const result = await withTimeout(submit(formData, reply));
        if (result.ok) {
          toast.success(successMessage);
          startTransition(() => {
            setOpen(false);
            setError(null);
            setConfirmation(null);
            onSuccess?.();
          });
        } else {
          startTransition(() => {
            setConfirmation(
              result.confirmation
                ? { prompt: result.confirmation, data: formData }
                : null,
            );
            setError(result.confirmation ? null : result.error);
          });
        }
      } catch {
        startTransition(() =>
          setError(
            "We could not confirm the save. Check the record before trying again.",
          ),
        );
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <>
      <Trigger onOpen={openForm}>{trigger}</Trigger>
      {open ? (
        <Dialog
          open={open}
          onOpenChange={(next) => (next ? openForm() : close())}
        >
          <DialogContent
            className={cn(
              "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0",
              width,
            )}
            showCloseButton={!pending}
          >
            <form
              onSubmit={handleSubmit}
              aria-busy={pending}
              className={styles.form}
            >
              <div
                ref={confirmationHeading}
                tabIndex={-1}
                className={styles.header}
              >
                <DialogHeader>
                  <DialogTitle>
                    {confirmation?.prompt.title ?? title}
                  </DialogTitle>
                  <DialogDescription
                    className={
                      confirmation?.prompt.description || description
                        ? undefined
                        : "sr-only"
                    }
                  >
                    {confirmation?.prompt.description ??
                      description ??
                      `Enter the details for ${title.toLowerCase()}.`}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className={styles.body}>
                <div hidden={!!confirmation}>
                  <div className="flex flex-col gap-4">{children}</div>
                </div>

                {error ? (
                  <div ref={errorMessage} tabIndex={-1}>
                    <Notice tone="error" title={error} />
                  </div>
                ) : null}
              </div>

              <div className={styles.footer}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={pending}
                >
                  Cancel
                </Button>
                {confirmation ? (
                  confirmation.prompt.choices.map((choice) => (
                    <Button
                      key={choice.value}
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        save(confirmation.data, {
                          choice: choice.value,
                          ids: confirmation.prompt.ids,
                        })
                      }
                    >
                      {choice.label}
                    </Button>
                  ))
                ) : (
                  <Button type="submit" disabled={pending}>
                    {pending ? "Saving…" : submitLabel}
                  </Button>
                )}
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

/** Capture the actual trigger before the dialog header takes focus. Restore
 * after unmount, when the native modal no longer makes the page inert. */
export function useDialogTriggerFocus(open: boolean) {
  const trigger = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    if (open || !trigger.current) return;
    const frame = requestAnimationFrame(() => {
      if (trigger.current?.isConnected)
        trigger.current.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);
  return (element?: HTMLElement) => {
    trigger.current =
      element ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
  };
}

/** Opens the dialog from whatever element the caller passed as the trigger:
 *  its own click handler still runs, then the dialog opens. */
export function Trigger({
  children,
  onOpen,
}: {
  children: React.ReactNode;
  onOpen: (element?: HTMLElement) => void;
}) {
  if (React.isValidElement<{ onClick?: React.MouseEventHandler }>(children)) {
    const inner = children.props.onClick;
    return React.cloneElement(children, {
      ...{ "aria-haspopup": "dialog" as const },
      onClick: (event: React.MouseEvent) => {
        inner?.(event);
        if (!event.defaultPrevented) {
          event.preventDefault();
          onOpen(event.currentTarget as HTMLElement);
        }
      },
    });
  }
  return (
    <Button
      type="button"
      onClick={(event) => onOpen(event.currentTarget)}
      aria-haspopup="dialog"
    >
      {children}
    </Button>
  );
}

/** The controls that draw their own label when handed one. Everything else
 *  receives a shared shadcn label and hint wrapper. */
const LABELLED = new Set<React.ElementType>([
  Input,
  Textarea,
  Select,
  Switch,
  SearchablePicker,
  StudentPicker,
]);

/** A labelled field. The label is handed to the control when it knows what
 *  to do with one, so the label, the hint and the control are one accessible
 *  field with the right spacing and association. */
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
  if (
    React.isValidElement<{ label?: string; description?: string; id?: string }>(
      children,
    ) &&
    LABELLED.has(children.type as React.ElementType)
  ) {
    return React.cloneElement(children, {
      label,
      description: hint,
      id: children.props.id ?? htmlFor,
    });
  }

  return (
    <FieldFrame label={label} id={htmlFor} description={hint}>
      {children}
    </FieldFrame>
  );
}
