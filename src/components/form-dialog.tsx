"use client";

import * as React from "react";
import { Button } from "@/components/shadcn/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { FormFeedbackProvider, useFormFeedback } from "@/components/ui/form-feedback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Notice } from "@/components/ui-kit/notice";
import { FieldFrame, fieldHintId } from "@/components/ui/field-frame";
import { cn } from "@/lib/utils";
import styles from "./form-dialog.module.css";
import type {
  ActionResult,
  ActionConfirmation,
  ConfirmationReply,
} from "@/lib/action-result";
import { toast } from "@/components/ui/toast";
import { withTimeout } from "@/lib/save-feedback";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SearchablePicker } from "@/components/searchable-picker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn/tooltip";
import { ChangeReview } from "@/components/ui-kit/change-review";
import { CountdownButton, useCountdown } from "@/components/ui/countdown-button";

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
  portalClassName,
  children,
  onOpen,
  onSuccess,
  onClose,
  defaultOpen = false,
  destructive = false,
  cancelLabel = "Cancel",
  pendingLabel,
  timeoutMs,
  countdown,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  submitLabel?: string;
  /** The submit removes or refuses something (cancel training, decline): a red submit. */
  destructive?: boolean;
  /** The dismiss button's label, when "Cancel" would echo the submit ("Keep it"). */
  cancelLabel?: string;
  successMessage: string;
  submit: (
    formData: FormData,
    confirmation?: ConfirmationReply,
  ) => Promise<ActionResult>;
  /** Widen for a form with two columns of fields. */
  width?: string;
  /** Theme scope for the portalled dialog, e.g. a Poolside Clear workspace. */
  portalClassName?: string;
  children: React.ReactNode;
  onOpen?: () => void;
  /** Complete an inline workflow after its dialog has saved successfully. */
  onSuccess?: () => void;
  /** After it closes, saved or not, e.g. to clear a timeline selection that opened it. */
  onClose?: () => void;
  /** Open on arrival (initial state only), e.g. a home page quick action's `?add=1`. */
  defaultOpen?: boolean;
  /** The submit's label while it runs, when "Saving…" would mislead (the AI writing a course). */
  pendingLabel?: string;
  /** How long to wait for a slow save before saying it couldn't be confirmed. */
  timeoutMs?: number;
  /** The dialog itself is the confirmation of a move or enrolment (Together's "Move them here"):
   *  hold the submit for a few seconds, starting again whenever `key` changes; `blocked` keeps it
   *  off (still checking, or a child cannot move). A server confirmation carrying a `change` is
   *  held the same way without this. */
  countdown?: { key: string; blocked?: boolean };
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const rememberTrigger = useDialogTriggerFocus(open);
  const { formRef, summaryRef, ...feedback } = useFormFeedback();
  const error = feedback.message;
  const setError = (message: string | null) => message ? feedback.report(message) : feedback.reset();
  const [pending, startTransition] = React.useTransition();
  const submitting = React.useRef(false);
  const [confirmation, setConfirmation] = React.useState<{
    prompt: ActionConfirmation;
    data: FormData;
  } | null>(null);
  const confirmationHeading = React.useRef<HTMLDivElement>(null);
  const change = confirmation?.prompt.change;
  const heldKey = !open ? null
    : change ? JSON.stringify([confirmation.prompt.title, confirmation.prompt.ids])
      : countdown && !countdown.blocked ? countdown.key : null;
  const left = useCountdown(heldKey);
  React.useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
  }, [confirmation]);

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
    onClose?.();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const formData = new FormData(event.currentTarget);
    if (confirmation) return;
    if (countdown && (countdown.blocked || left > 0)) return;
    save(formData);
  }

  function save(formData: FormData, reply?: ConfirmationReply) {
    if (submitting.current) return;
    submitting.current = true;
    setError(null);

    startTransition(async () => {
      try {
        const result = await withTimeout(submit(formData, reply), timeoutMs);
        if (result.ok) {
          toast.success(successMessage);
          startTransition(() => {
            setOpen(false);
            setError(null);
            setConfirmation(null);
            onSuccess?.();
            onClose?.();
          });
        } else {
          startTransition(() => {
            setConfirmation(
              result.confirmation
                ? { prompt: result.confirmation, data: formData }
                : null,
            );
            if (result.confirmation) feedback.reset();
            else feedback.report(result);
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
            portalClassName={portalClassName}
            className={cn(
              "flex max-h-(--overlay-max-height) flex-col gap-0 p-0",
              width,
              change && "sm:max-w-2xl",
            )}
            showCloseButton={false}
          >
            <FormFeedbackProvider feedback={feedback}><form
              ref={formRef}
              method="post"
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
                <fieldset hidden={!!confirmation} disabled={pending || !!confirmation} className="min-w-0">
                  <div className="flex flex-col gap-4">{children}</div>
                </fieldset>

                {change ? <ChangeReview change={change} /> : null}

                {error ? (
                  <div ref={summaryRef} tabIndex={-1}>
                    <Notice tone="error" live="alert" title={error} />
                  </div>
                ) : null}
              </div>

              <DialogFooter className="shrink-0 p-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={pending}
                >
                  {cancelLabel}
                </Button>
                {change ? (
                  <Button type="button" variant="outline" onClick={() => setConfirmation(null)} disabled={pending}>
                    Back
                  </Button>
                ) : null}
                {confirmation && change ? (
                  confirmation.prompt.choices.map((choice, index, all) => (
                    <CountdownButton
                      key={choice.value}
                      type="button"
                      variant={index === all.length - 1 ? "default" : "outline"}
                      left={left}
                      pending={pending}
                      pendingLabel={pendingLabel}
                      announce={index === all.length - 1}
                      onClick={() =>
                        save(confirmation.data, {
                          choice: choice.value,
                          ids: confirmation.prompt.ids,
                        })
                      }
                    >
                      {choice.label}
                    </CountdownButton>
                  ))
                ) : confirmation ? (
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
                ) : countdown ? (
                  <CountdownButton type="submit" left={left} disabled={countdown.blocked} pending={pending} pendingLabel={pendingLabel}>{submitLabel}</CountdownButton>
                ) : (
                  <LoadingButton type="submit" variant={destructive ? "destructive" : "default"} pending={pending} pendingLabel={pendingLabel}>{submitLabel}</LoadingButton>
                )}
                {confirmation && pending ? <span role="status" className="text-sm text-ui-muted-foreground">Saving change…</span> : null}
              </DialogFooter>
            </form></FormFeedbackProvider>
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
  // A trigger handed down from a server page can arrive as a lazy element, which
  // isValidElement refuses; Children.toArray resolves it, so the server and the
  // browser draw the same single button.
  const parts = React.Children.toArray(children);
  const child = parts.length === 1 ? parts[0] : children;
  if (React.isValidElement<{ onClick?: React.MouseEventHandler; "aria-label"?: string; size?: string }>(child)) {
    const inner = child.props.onClick;
    const trigger = React.cloneElement(child, {
      ...{ "aria-haspopup": "dialog" as const },
      onClick: (event: React.MouseEvent) => {
        inner?.(event);
        if (!event.defaultPrevented) {
          event.preventDefault();
          onOpen(event.currentTarget as HTMLElement);
        }
      },
    });
    return child.props.size?.startsWith("icon") && child.props["aria-label"]
      ? <Tooltip><TooltipTrigger asChild>{trigger}</TooltipTrigger><TooltipContent>{child.props["aria-label"]}</TooltipContent></Tooltip>
      : trigger;
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
 *  receives a shared shadcn label and hint wrapper. Module controls (such as
 *  Aquatics' swimmer picker) add themselves with `labelsItself`, so this
 *  shared file never imports a module. */
const LABELLED = new Set<React.ElementType>([
  Input,
  Textarea,
  Select,
  Switch,
  SearchablePicker,
]);

/** Declare that a control draws its own label, hint and id when a Field hands
 *  them over. Call once beside the control's definition. */
export function labelsItself<T extends React.ElementType>(control: T): T {
  LABELLED.add(control);
  return control;
}

/** A labelled field. The label is handed to the control when it knows what
 *  to do with one, so the label, the hint and the control are one accessible
 *  field with the right spacing and association. */
export function Field({
  label,
  htmlFor,
  hint,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  /** Shows "Optional" in the caption under the label; required fields stay unmarked. */
  optional?: boolean;
  children: React.ReactNode;
}) {
  if (
    React.isValidElement<{ label?: string; description?: string; optional?: boolean; id?: string }>(
      children,
    ) &&
    LABELLED.has(children.type as React.ElementType)
  ) {
    return React.cloneElement(children, {
      label,
      description: hint,
      optional,
      id: children.props.id ?? htmlFor,
    });
  }

  // Any other control: describe it by the caption when it is the labelled element.
  const hintId = fieldHintId(htmlFor, optional, hint);
  const control =
    hintId &&
    React.isValidElement<{ id?: string; "aria-describedby"?: string }>(children) &&
    children.props.id === htmlFor
      ? React.cloneElement(children, {
          "aria-describedby":
            [children.props["aria-describedby"], hintId].filter(Boolean).join(" "),
        })
      : children;
  return (
    <FieldFrame label={label} id={htmlFor} description={hint} optional={optional}>
      {control}
    </FieldFrame>
  );
}
