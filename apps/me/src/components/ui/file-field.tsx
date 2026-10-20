"use client";

import * as React from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { FieldFrame, fieldHintId } from "./field-frame";

export type FileFieldProps = Omit<React.ComponentProps<"input">, "type" | "id" | "className"> & {
  id?: string;
  label: string;
  /** The caption under the label: what files are accepted. */
  description?: string;
  optional?: boolean;
  /** An error from the consumer (a file it refused); a missing required file has its own. */
  error?: string;
  className?: string;
  /** While a file uploads as soon as it is chosen: the button shows `pendingLabel` and waits. */
  pending?: boolean;
  pendingLabel?: string;
};

/** One file field (Poolside Clear v2, MeQualifications): the label, the caption hint, then a
 *  full-width outline pill "Choose a file". The native input stays in the form (sr-only, never a
 *  tab stop), so FormData, `required`, `accept` and form.reset() work as before; the button is
 *  the one control. The chosen file's name shows as a caption. */
export function FileField({
  id: suppliedId,
  label,
  description,
  optional,
  error,
  className,
  pending = false,
  pendingLabel = "Uploading…",
  ref,
  onChange,
  onInvalid,
  ...props
}: FileFieldProps) {
  const generatedId = React.useId();
  const id = suppliedId ?? generatedId;
  const input = React.useRef<HTMLInputElement | null>(null);
  const button = React.useRef<HTMLButtonElement>(null);
  const [fileName, setFileName] = React.useState("");
  const [missing, setMissing] = React.useState(false);
  const setInput = React.useCallback(
    (node: HTMLInputElement | null) => {
      input.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  React.useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const reset = () => {
      setFileName("");
      setMissing(false);
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);
  const message = error ?? (missing ? `Choose ${label.toLowerCase()}.` : undefined);
  return (
    <FieldFrame id={id} label={label} description={description} optional={optional} error={message} className={className}>
      <div className="relative min-w-0">
        <Input
          {...props}
          ref={setInput}
          id={`${id}-input`}
          // Named only once a file is chosen: an empty file entry can reach a server action
          // with a name, so "no file" must post nothing at all. `required` still applies.
          name={fileName ? props.name : undefined}
          type="file"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onInvalid={(event) => {
            onInvalid?.(event);
            event.preventDefault();
            setMissing(true);
            button.current?.focus();
          }}
          onChange={(event) => {
            onChange?.(event);
            // Read after the consumer, which may have cleared a refused file.
            const files = Array.from(event.currentTarget.files ?? []);
            setFileName(files.map((file) => file.name).join(", "));
            setMissing(false);
          }}
        />
        <Button
          ref={button}
          id={id}
          type="button"
          variant="outline"
          disabled={props.disabled}
          aria-labelledby={label ? `${id}-label ${id}` : undefined}
          aria-describedby={
            [fieldHintId(id, optional, description), fileName ? `${id}-file` : null, message ? `${id}-error` : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-invalid={message ? true : undefined}
          aria-disabled={pending || undefined}
          aria-busy={pending || undefined}
          className="w-full justify-start"
          onClick={() => { if (!pending) input.current?.click(); }}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
          {pending ? pendingLabel : "Choose a file"}
        </Button>
        <span aria-live="polite" aria-atomic="true" className="sr-only">{pending ? pendingLabel : ""}</span>
      </div>
      {fileName ? (
        <p id={`${id}-file`} data-slot="field-description" className="text-xs break-all text-ui-muted-foreground">
          {fileName}
        </p>
      ) : null}
    </FieldFrame>
  );
}
