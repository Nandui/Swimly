"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { cn } from "@/lib/utils";

type Common = {
  label: string;
  /** Keep the label for screen readers only, where the screen already names the list. */
  labelHidden?: boolean;
  /** An example of what to type, with no trailing ellipsis. */
  placeholder?: string;
  maxLength?: number;
  id?: string;
  className?: string;
};

/** The one search field (Poolside Clear v2: V2Swimmers, V2Classes, V2Awaiting, SSLegend): a
 *  visible label over a 44px pill with a leading search icon, and no visible submit button.
 *
 *  - Uncontrolled (`name`, `defaultValue`) inside a GET form: Enter submits the form through a
 *    hidden submit button that is never a tab stop. `clearHref` adds a ghost "Clear" link.
 *  - Controlled (`value`, `onValueChange`) for a live filter: no submit at all; "Clear" empties it.
 *
 *  Exact lookups (such as finding a parent account) keep their own visible button instead. */
export function SearchField(
  props: Common &
    (
      | { name?: string; defaultValue?: string; clearHref?: string; value?: never; onValueChange?: never }
      | { value: string; onValueChange: (value: string) => void; name?: string; defaultValue?: never; clearHref?: never }
    ),
) {
  const generatedId = React.useId();
  const id = props.id ?? generatedId;
  const controlled = props.onValueChange !== undefined;
  const filled = controlled ? Boolean(props.value) : Boolean(props.defaultValue);
  return (
    <div className={cn("min-w-0 space-y-2", props.className)}>
      <Label htmlFor={id} className={props.labelHidden ? "sr-only" : "block"}>
        {props.label}
      </Label>
      <div className="flex min-w-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ui-muted-foreground"
          />
          {controlled ? (
            <Input
              id={id}
              type="search"
              name={props.name}
              enterKeyHint="search"
              autoComplete="off"
              placeholder={props.placeholder}
              maxLength={props.maxLength}
              value={props.value}
              onChange={(event) => props.onValueChange?.(event.target.value)}
              className="h-11 pl-10"
            />
          ) : (
            <Input
              key={props.defaultValue ?? ""}
              id={id}
              type="search"
              name={props.name ?? "q"}
              enterKeyHint="search"
              autoComplete="off"
              placeholder={props.placeholder}
              maxLength={props.maxLength}
              defaultValue={props.defaultValue ?? ""}
              className="h-11 pl-10"
            />
          )}
        </div>
        {filled && controlled ? (
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => props.onValueChange?.("")}>
            Clear
          </Button>
        ) : filled && props.clearHref ? (
          <Button asChild variant="ghost" className="min-h-11">
            <Link href={props.clearHref}>Clear</Link>
          </Button>
        ) : null}
        {/* Enter submits the surrounding form even when it holds other fields. Kept in the
            row so it adds no space under the field. */}
        {controlled ? null : (
          <Button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
            Search
          </Button>
        )}
      </div>
    </div>
  );
}
