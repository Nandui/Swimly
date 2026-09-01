"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchStudents, type StudentHit } from "@/lib/students/actions/search";
import { ageLabel, fullName } from "@/lib/students/constants";
import { cn } from "@/lib/utils";

/** How long to wait after the last keystroke before asking. Long enough that a
 *  typed surname is one request rather than seven, short enough that it never
 *  reads as lag. */
const DEBOUNCE_MS = 200;

/** Finding one swimmer among a thousand, without being sent the thousand.
 *
 *  The searchable pickers elsewhere take their options as props and let cmdk
 *  filter them in the browser. That is right for classes — there are 134 — and
 *  wrong for swimmers, where it meant every page with the picker on it carried
 *  the whole roll. This one asks the server for the twenty that match what has
 *  been typed so far, and nothing else ever crosses the wire.
 *
 *  `shouldFilter={false}` is the load-bearing prop: cmdk would otherwise filter
 *  the twenty again against the same text, and hide a match whose member
 *  number was what matched. The server already decided. */
export function StudentSearch({
  trigger,
  onSelect,
  selectedId,
  exclude = [],
  placeholder = "Search by name or member number…",
  emptyText = "Nobody by that name.",
}: {
  trigger: React.ReactNode;
  onSelect: (hit: StudentHit) => void;
  selectedId?: string | null;
  /** Swimmers not to offer — the ones already in the group, say. */
  exclude?: string[];
  placeholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  // The answer is stored with the question it answers, so a stale answer is
  // recognised by comparison rather than cleared by an effect — which is also
  // what keeps the previous names from flashing under a new search.
  const [result, setResult] = React.useState<{ term: string; hits: StudentHit[] }>({
    term: "",
    hits: [],
  });
  const [pending, startTransition] = React.useTransition();
  // Replies can land out of order on a slow connection; only the newest
  // question's answer is allowed in.
  const latest = React.useRef(0);
  const excludeKey = exclude.join(",");
  const term = q.trim();

  React.useEffect(() => {
    if (!open || !term) return;
    const request = ++latest.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const found = await searchStudents(term, excludeKey ? excludeKey.split(",") : []);
        if (request === latest.current) setResult({ term, hits: found });
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, excludeKey, open]);

  const answered = result.term === term;
  const hits = answered ? result.hits : [];
  const status = !term
    ? "Start typing a name or a member number."
    : hits.length > 0
      ? null
      : answered && !pending
        ? emptyText
        : "Searching…";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQ("");
          setResult({ term: "", hits: [] });
        }
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder={placeholder} />
          <CommandList>
            {status ? (
              <p className="py-6 text-center text-sm text-muted-foreground" role="status">
                {status}
              </p>
            ) : (
              <CommandGroup>
                {hits.map((hit) => (
                  <CommandItem
                    key={hit.id}
                    value={hit.id}
                    onSelect={() => {
                      onSelect(hit);
                      setOpen(false);
                    }}
                    className="[&>svg]:ml-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{fullName(hit)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {ageLabel(hit.dateOfBirth)}
                        {hit.memberNumber ? ` · ${hit.memberNumber}` : ""}
                      </span>
                    </span>
                    {hit.id === selectedId ? <Check className="size-3.5 shrink-0" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** The search as a form field. Posts the chosen id through a hidden input, so
 *  it sits inside the same plain `<form>` as every other field, exactly as
 *  `SearchablePicker` does. */
export function StudentPicker({
  name,
  id,
  placeholder = "Pick a swimmer",
}: {
  name: string;
  id?: string;
  placeholder?: string;
}) {
  const [chosen, setChosen] = React.useState<StudentHit | null>(null);

  return (
    <>
      <input type="hidden" name={name} value={chosen?.id ?? ""} />
      <StudentSearch
        selectedId={chosen?.id}
        onSelect={setChosen}
        trigger={
          <Button
            id={id}
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !chosen && "text-muted-foreground")}>
              {chosen ? fullName(chosen) : placeholder}
            </span>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          </Button>
        }
      />
    </>
  );
}
