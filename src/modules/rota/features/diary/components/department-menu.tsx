"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";

/** The department the Plan shows, as the fin-blue menu in the line under its title (DESIGN.md,
 *  Toolbar and page: "Pool department ⌄"). Each choice is a link, so the day and site stay. */
export function DepartmentMenu({ current, items }: { current: string; items: { href: string; label: string; current: boolean }[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rota-dept-menu" aria-label={`Department: ${current}. Change department`}>
        {current}<ChevronDown aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-w-(--pc-overlay-max-width)">
        <DropdownMenuLabel className="text-xs font-semibold text-ui-muted-foreground">Department</DropdownMenuLabel>
        {items.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href} aria-current={item.current ? "page" : undefined}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
