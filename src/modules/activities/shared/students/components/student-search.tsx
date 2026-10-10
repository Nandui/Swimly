"use client";

import { labelsItself } from "@/components/form-dialog";
import * as React from "react";
import { ChevronDown, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { IconButton } from "@/components/ui/icon-button";
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
import { FieldFrame, fieldHintId } from "@/components/ui/field-frame";
import { Notice } from "@/components/ui-kit/notice";
import { searchStudents, type StudentHit } from "@/modules/activities/shared/students/actions/search";
import { ageLabel, fullName } from "@/modules/activities/shared/students/constants";

/** Server search remains debounced, scoped and protected against stale responses. */
export function StudentSearch({
  onSelect,
  selected = null,
  exclude = [],
  label = "Swimmer",
  labelHidden = false,
  description,
  placeholder = "Search by name or member number…",
  emptyText = "Nobody by that name.",
  includeInactive = false,
  hasSearchIcon = false,
  id: suppliedId,
  optional,
}: {
  onSelect: (hit: StudentHit | null) => void;
  selected?: StudentHit | null;
  exclude?: string[];
  label?: string;
  labelHidden?: boolean;
  description?: string;
  optional?: boolean;
  placeholder?: string;
  emptyText?: string;
  includeInactive?: boolean;
  hasSearchIcon?: boolean;
  id?: string;
}) {
  const generatedId = React.useId(),
    id = suppliedId ?? generatedId;
  const [open, setOpen] = React.useState(false),
    [query, setQuery] = React.useState("");
  const [result, setResult] = React.useState<{
    key: string;
    hits: StudentHit[];
    error: string | null;
  }>({ key: "", hits: [], error: null });
  const excludeKey = JSON.stringify(exclude),
    term = query.trim();
  const key = JSON.stringify([term, excludeKey, includeInactive]);
  React.useEffect(() => {
    if (!open || !term) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const hits = await searchStudents(
          term,
          JSON.parse(excludeKey),
          includeInactive,
        );
        if (!cancelled) setResult({ key, hits, error: null });
      } catch {
        if (!cancelled)
          setResult({
            key,
            hits: [],
            error:
              "Could not search swimmers. Check your connection and try again.",
          });
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, term, key, excludeKey, includeInactive]);
  const pending = Boolean(term) && result.key !== key;
  const hits = term && result.key === key ? result.hits : [];
  const error = term && result.key === key ? result.error : null;
  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResult({ key: "", hits: [], error: null });
    }
  }
  return (
    <FieldFrame
      id={id}
      label={labelHidden ? undefined : label}
      description={description}
      optional={optional}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Popover open={open} onOpenChange={changeOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              data-slot="select-trigger"
              aria-expanded={open}
              aria-label={label}
              aria-describedby={fieldHintId(id, optional, description)}
              className="h-auto min-h-11 min-w-0 flex-1 justify-between gap-2 text-left whitespace-normal"
            >
              {hasSearchIcon ? (
                <Search className="size-4 text-ui-muted-foreground" aria-hidden="true" />
              ) : null}
              <span className="min-w-0 flex-1">
                <span className={selected ? undefined : "text-ui-muted-foreground"}>
                  {selected ? fullName(selected) : placeholder}
                </span>
              </span>
              <ChevronDown className="size-4 text-ui-muted-foreground" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[var(--radix-popover-trigger-width)] p-0"
          >
            <Command shouldFilter={false}>
              <CommandInput
                value={query}
                onValueChange={setQuery}
                aria-label="Search swimmers"
                placeholder={placeholder}
              />
              <CommandList aria-busy={pending}>
                {!term ? (
                  <CommandEmpty>
                    Start typing a name or member number.
                  </CommandEmpty>
                ) : pending ? (
                  <div
                    role="status"
                    className="flex items-center gap-2 p-4 text-sm text-ui-muted-foreground"
                  >
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Searching…
                  </div>
                ) : error ? (
                  <div className="p-2">
                    <Notice tone="error" live="alert" title={error} />
                  </div>
                ) : !hits.length ? (
                  <CommandEmpty>{emptyText}</CommandEmpty>
                ) : null}
                {hits.length ? (
                  <CommandGroup heading="Swimmers">
                    {hits.map((hit) => (
                      <CommandItem
                        key={hit.id}
                        value={hit.id}
                        onSelect={() => {
                          onSelect(hit);
                          changeOpen(false);
                        }}
                      >
                        <span>
                          <span className="block font-semibold">
                            {fullName(hit)}
                          </span>
                          <span className="block text-xs text-ui-muted-foreground">
                            {ageLabel(hit.dateOfBirth)}
                            {hit.memberNumber ? ` · ${hit.memberNumber}` : ""}
                            {hit.status === "INACTIVE" ? " · Inactive" : ""}
                          </span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selected ? (
          <IconButton
            type="button"
            size="icon"
            variant="ghost"
            label="Clear selected swimmer"
            onClick={() => onSelect(null)}
          >
            <X aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>
    </FieldFrame>
  );
}

export function StudentPicker({
  name,
  id,
  label,
  description,
  optional,
  placeholder = "Search by name or member number…",
  onValueChange,
}: {
  name: string;
  id?: string;
  label?: string;
  description?: string;
  optional?: boolean;
  placeholder?: string;
  onValueChange?: (value: string) => void;
}) {
  const [chosen, setChosen] = React.useState<StudentHit | null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const reset = () => { setChosen(null); onValueChange?.(""); };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [onValueChange]);
  return (
    <>
      <input ref={input} type="hidden" name={name} value={chosen?.id ?? ""} />
      <StudentSearch
        id={id}
        label={label ?? "Swimmer"}
        labelHidden={label === undefined}
        description={description}
        optional={optional}
        selected={chosen}
        onSelect={hit => { setChosen(hit); onValueChange?.(hit?.id ?? ""); }}
        placeholder={placeholder}
      />
    </>
  );
}

// Field hands its label, hint and id to the picker instead of wrapping it.
labelsItself(StudentPicker);
