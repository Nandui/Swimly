"use client";

import * as React from "react";
import { ChevronsUpDown, Loader2, Search, X } from "lucide-react";
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
import { FieldFrame } from "@/components/ui/field-frame";
import { searchStudents, type StudentHit } from "@/lib/students/actions/search";
import { ageLabel, fullName } from "@/lib/students/constants";

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
}: {
  onSelect: (hit: StudentHit | null) => void;
  selected?: StudentHit | null;
  exclude?: string[];
  label?: string;
  labelHidden?: boolean;
  description?: string;
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
    >
      <div className="flex min-w-0 items-center gap-2">
        <Popover open={open} onOpenChange={changeOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-label={label}
              aria-describedby={description ? `${id}-hint` : undefined}
              className="h-auto min-h-11 min-w-0 flex-1 justify-between text-left font-normal whitespace-normal"
            >
              {hasSearchIcon ? (
                <Search className="size-4" aria-hidden="true" />
              ) : null}
              <span className="min-w-0 flex-1">
                {selected ? fullName(selected) : placeholder}
              </span>
              <ChevronsUpDown className="size-4" aria-hidden="true" />
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
                  <p role="alert" className="p-4 text-sm text-ui-destructive">
                    {error}
                  </p>
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
                          <span className="block font-medium">
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
  placeholder = "Search by name or member number…",
}: {
  name: string;
  id?: string;
  label?: string;
  description?: string;
  placeholder?: string;
}) {
  const [chosen, setChosen] = React.useState<StudentHit | null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const reset = () => setChosen(null);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);
  return (
    <>
      <input ref={input} type="hidden" name={name} value={chosen?.id ?? ""} />
      <StudentSearch
        id={id}
        label={label ?? "Swimmer"}
        labelHidden={label === undefined}
        description={description}
        selected={chosen}
        onSelect={setChosen}
        placeholder={placeholder}
      />
    </>
  );
}
