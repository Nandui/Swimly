"use client";

import * as React from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Field as AstryxField } from "@astryxdesign/core/Field";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import type { ActionResult } from "@/lib/action-result";
import { toast } from "@/lib/toast";
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
  submit: (formData: FormData) => Promise<ActionResult>;
  /** Widen for a form with two columns of fields. */
  width?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function close() {
    setOpen(false);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await submit(formData);
      if (result.ok) {
        toast.success(successMessage);
        startTransition(() => close());
      } else {
        startTransition(() => setError(result.error));
      }
    });
  }

  return (
    <>
      <Trigger onOpen={() => setOpen(true)}>{trigger}</Trigger>
      <Dialog
        isOpen={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        purpose="form"
        width={WIDTHS[width] ?? 448}
      >
        <form onSubmit={handleSubmit}>
          <VStack gap={4}>
            <DialogHeader title={title} subtitle={description} onOpenChange={() => close()} />

            <VStack gap={3}>{children}</VStack>

            {error ? <Banner status="error" title={error} collapsible={false} /> : null}

            <HStack gap={2} hAlign="end">
              <Button type="button" label="Cancel" variant="secondary" onClick={close} />
              <Button
                type="submit"
                label={pending ? "Saving…" : submitLabel}
                variant="primary"
                isLoading={pending}
              />
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
      onClick: (event: React.MouseEvent) => {
        inner?.(event);
        if (!event.defaultPrevented) onOpen();
      },
    });
  }
  return (
    <HStack as="span" onClick={onOpen}>
      {children}
    </HStack>
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
