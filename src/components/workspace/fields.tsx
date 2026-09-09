"use client";
import * as React from "react";
import { X, type LucideIcon } from "lucide-react";
import { Input } from "@/components/primitives/input";
import { Textarea } from "@/components/primitives/textarea";
import { cn } from "@/lib/utils";
export function Field({
  label,
  inputID,
  description,
  isLabelHidden,
  children,
  className,
}: {
  label: string;
  inputID?: string;
  description?: React.ReactNode;
  isLabelHidden?: boolean;
  children: React.ReactNode;
  width?: "100%";
  className?: string;
}) {
  return (
    <div className={cn("workspace-field", className)}>
      <label
        htmlFor={inputID}
        className={isLabelHidden ? "sr-only" : "workspace-field-label"}
      >
        {label}
      </label>
      {children}
      {description && (
        <p
          id={inputID ? `${inputID}-hint` : undefined}
          className="workspace-field-hint"
        >
          {description}
        </p>
      )}
    </div>
  );
}
type TextInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "onChange" | "size" | "value"
> & {
  label: string;
  description?: React.ReactNode;
  isLabelHidden?: boolean;
  htmlName?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  isReadOnly?: boolean;
  hasAutoFocus?: boolean;
  onChange?: (value: string) => void;
  value?: string;
  startIcon?: LucideIcon;
  hasClear?: boolean;
  width?: "100%";
};
export function TextInput({
  label,
  description,
  isLabelHidden,
  htmlName,
  isDisabled,
  isRequired,
  isReadOnly,
  hasAutoFocus,
  onChange,
  value,
  startIcon: StartIcon,
  hasClear,
  width,
  id,
  ref,
  className,
  ...props
}: TextInputProps) {
  const generated = React.useId();
  const inputId = id ?? generated;
  return (
    <Field
      label={label}
      inputID={inputId}
      description={description}
      isLabelHidden={isLabelHidden}
      className={cn(width && "w-full", className)}
    >
      <div className="relative">
        {StartIcon && (
          <StartIcon
            className="absolute left-3 top-3.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <Input
          {...props}
          ref={ref}
          id={inputId}
          name={htmlName ?? props.name}
          value={value}
          disabled={isDisabled ?? props.disabled}
          required={isRequired ?? props.required}
          readOnly={isReadOnly ?? props.readOnly}
          autoFocus={hasAutoFocus ?? props.autoFocus}
          onChange={(e) => onChange?.(e.target.value)}
          aria-describedby={
            description ? `${inputId}-hint` : props["aria-describedby"]
          }
          className={cn(StartIcon && "pl-10", hasClear && value && "pr-12")}
        />
        {hasClear && value && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            className="absolute right-0 top-0 size-11 flex items-center justify-center"
            onClick={() => onChange?.("")}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </Field>
  );
}
export function TextArea({
  label,
  description,
  isLabelHidden,
  htmlName,
  isDisabled,
  isRequired,
  isReadOnly,
  hasAutoFocus,
  onChange,
  value,
  width,
  id,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Textarea>, "onChange"> & {
  label: string;
  description?: React.ReactNode;
  isLabelHidden?: boolean;
  htmlName?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  isReadOnly?: boolean;
  hasAutoFocus?: boolean;
  onChange?: (
    value: string,
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => void;
  width?: "100%";
}) {
  const generated = React.useId();
  const inputId = id ?? generated;
  return (
    <Field
      label={label}
      inputID={inputId}
      description={description}
      isLabelHidden={isLabelHidden}
      className={cn(width && "w-full", className)}
    >
      <Textarea
        {...props}
        id={inputId}
        name={htmlName ?? props.name}
        value={value}
        disabled={isDisabled ?? props.disabled}
        required={isRequired ?? props.required}
        readOnly={isReadOnly ?? props.readOnly}
        autoFocus={hasAutoFocus ?? props.autoFocus}
        aria-describedby={
          description ? `${inputId}-hint` : props["aria-describedby"]
        }
        onChange={(e) => onChange?.(e.target.value, e)}
      />
    </Field>
  );
}
export function FileInput({
  label,
  description,
  accept,
  maxSize,
  onChange,
}: {
  label: string;
  description?: string;
  accept: string;
  maxSize: number;
  onChange: (file: File | null) => void;
  value: File | null;
  mode?: "dropzone";
  isOptional?: boolean;
}) {
  const id = React.useId();
  const [error, setError] = React.useState("");
  return (
    <Field label={label} inputID={id} description={error || description}>
      <Input
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          if (file && file.size > maxSize) {
            setError("Choose a smaller file.");
            e.target.value = "";
            return;
          }
          setError("");
          onChange(file);
        }}
      />
    </Field>
  );
}
