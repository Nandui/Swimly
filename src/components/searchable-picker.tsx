"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/shadcn/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/popover";
import { FieldFrame } from "@/components/ui/field-frame";

export type PickerOption = {
  value: string;
  label: string;
  hint?: string;
  meta?: string;
  disabled?: boolean;
};

/** A searchable, bounded option set that posts the selected id through FormData. */
export function SearchablePicker({
  name,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  defaultValue = "",
  id: suppliedId,
  label,
  description,
  onValueChange,
}: {
  name: string;
  options: PickerOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  defaultValue?: string;
  id?: string;
  label?: string;
  description?: string;
  onValueChange?: (value: string) => void;
}) {
  const generatedId = React.useId(),
    id = suppliedId ?? generatedId;
  const [value, setValue] = React.useState(defaultValue),
    [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value);
  const input = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const reset = () => {
      setValue(defaultValue);
      onValueChange?.(defaultValue);
      setOpen(false);
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue, onValueChange]);
  return (
    <FieldFrame id={id} label={label} description={description}>
      <input ref={input} type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={label ?? placeholder}
            aria-describedby={description ? `${id}-hint` : undefined}
            className="h-auto min-h-9 w-full justify-between text-left font-normal whitespace-normal"
          >
            <span className="min-w-0">{selected?.label ?? placeholder}</span>
            <ChevronsUpDown
              className="size-4 shrink-0 text-ui-muted-foreground"
              aria-hidden="true"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command>
            <CommandInput
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.hint ?? ""} ${option.meta ?? ""} ${option.value}`}
                    disabled={option.disabled}
                    onSelect={() => {
                      setValue(option.value);
                      onValueChange?.(option.value);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block">{option.label}</span>
                      {option.hint || option.meta ? (
                        <span className="block text-xs text-ui-muted-foreground">
                          {[option.hint, option.meta]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                    </span>
                    {value === option.value ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FieldFrame>
  );
}
