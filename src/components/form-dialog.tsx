"use client";

import * as React from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Field as AstryxField } from "@astryxdesign/core/Field";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import type { ActionResult, ActionConfirmation, ConfirmationReply } from "@/lib/action-result";
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

/** The old Tailwind widths, kept as the prop's vocabulary so no call site
 *  had to change; Astryx takes pixels. */
const WIDTHS: Record<string, number> = {
  "sm:max-w-sm": 384,
  "sm:max-w-md": 448,
  "sm:max-w-lg": 512,
  "sm:max-w-xl": 576,
  "sm:max-w-2xl": 672,
};

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
  submit: (formData: FormData, confirmation?: ConfirmationReply) => Promise<ActionResult>;
  /** Widen for a form with two columns of fields. */
  width?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [formVersion, setFormVersion] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const submitting = React.useRef(false);
  const [confirmation, setConfirmation] = React.useState<{ prompt: ActionConfirmation; data: FormData } | null>(null);
  const confirmationHeading = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
  }, [confirmation]);

  function openForm() {
    // Astryx retains dialog content while closed. Remount the controlled
    // adapters for a fresh edit, using the latest record's default values.
    // Failed saves keep this version so they preserve the user's input.
    if (!open) setFormVersion((version) => version + 1);
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
          });
        } else {
          startTransition(() => {
            setConfirmation(result.confirmation ? { prompt: result.confirmation, data: formData } : null);
            setError(result.confirmation ? null : result.error);
          });
        }
      } catch {
        startTransition(() =>
          setError("We could not confirm the save. Check the record before trying again.")
        );
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <>
      <Trigger onOpen={openForm}>{trigger}</Trigger>
      <Dialog
        isOpen={open}
        onOpenChange={(next) => (next ? openForm() : close())}
        purpose={pending ? "required" : "form"}
        width={WIDTHS[width] ?? 448}
      >
        <form key={formVersion} onSubmit={handleSubmit} aria-busy={pending}>
          <VStack gap={4}>
            <div ref={confirmationHeading} tabIndex={-1}>
              <DialogHeader title={confirmation?.prompt.title ?? title} subtitle={confirmation?.prompt.description ?? description} onOpenChange={pending ? undefined : close} />
            </div>

            <div hidden={!!confirmation}>
              <FormLayout defaultOptionality="optional">{children}</FormLayout>
            </div>

            {error ? <Banner status="error" title={error} collapsible={false} /> : null}

            <HStack gap={2} hAlign="end" wrap="wrap">
              <Button type="button" label="Cancel" variant="secondary" onClick={close} isDisabled={pending} />
              {confirmation ? confirmation.prompt.choices.map((choice) => (
                <Button key={choice.value} type="button" label={choice.label} variant="secondary"
                  isDisabled={pending} onClick={() => save(confirmation.data, { choice: choice.value, ids: confirmation.prompt.ids })} />
              )) : <Button
                type="submit"
                label={pending ? "Saving…" : submitLabel}
                variant="primary"
                isLoading={pending}
              />}
            </HStack>
          </VStack>
        </form>
      </Dialog>
    </>
  );
}

/** Opens the dialog from whatever element the caller passed as the trigger:
 *  its own click handler still runs, then the dialog opens. */
export function Trigger({
  children,
  onOpen,
}: {
  children: React.ReactNode;
  onOpen: () => void;
}) {
  if (React.isValidElement<{ onClick?: React.MouseEventHandler }>(children)) {
    const inner = children.props.onClick;
    return React.cloneElement(children, {
      ...{ "aria-haspopup": "dialog" as const },
      onClick: (event: React.MouseEvent) => {
        inner?.(event);
        if (!event.defaultPrevented) onOpen();
      },
    });
  }
  return (
    <Button type="button" label={typeof children === "string" ? children : "Open dialog"} onClick={onOpen} aria-haspopup="dialog">
      {children}
    </Button>
  );
}

/** The controls that draw their own label when handed one. Everything else
 *  is wrapped in Astryx's Field, which draws the label for it. */
const LABELLED = new Set<React.ElementType>([
  Input,
  Textarea,
  Select,
  Switch,
  SearchablePicker,
  StudentPicker,
]);

/** A labelled field. The label is handed to the control when it knows what
 *  to do with one, so the label, the hint and the control are one Astryx
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
    React.isValidElement<{ label?: string; description?: string; id?: string }>(children) &&
    LABELLED.has(children.type as React.ElementType)
  ) {
    return React.cloneElement(children, {
      label,
      description: hint,
      id: children.props.id ?? htmlFor,
    });
  }

  return (
    <AstryxField label={label} inputID={htmlFor} description={hint} width="100%">
      {children}
    </AstryxField>
  );
}
