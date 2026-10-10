"use client";

import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";

/** A select-style pill whose choices are links (V2Rota's "Week · This week" and "Department ·
 *  All"): the muted name, the value and a chevron. Each choice is a page of its own, so arrowing
 *  through the menu never navigates (unlike a native select that loads on change). */
export function LinkPicker({ name, options }: { name: string; options: { href: string; label: string; current: boolean }[] }) {
  const current = options.find((o) => o.current) ?? options[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-0 border-[var(--pc-line-strong)] font-normal" aria-label={`${name}: ${current?.label}. Change ${name.toLowerCase()}`}>
          <span className="text-ui-muted-foreground">{name}</span>
          <span className="min-w-0 truncate font-semibold">{current?.label}</span>
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-w-(--pc-overlay-max-width)">
        {options.map((o) => (
          <DropdownMenuItem key={o.href} asChild className="min-h-11">
            <Link href={o.href} aria-current={o.current ? "page" : undefined}>
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.current ? <Check aria-hidden="true" /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
