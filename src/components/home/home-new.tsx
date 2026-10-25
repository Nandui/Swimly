"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { ACTION_ICONS } from "@/components/home/home-parts";
import type { HomeIcon } from "@/modules/contributions";

/** Home's one prominent action (DESIGN.md, New): the things a person starts from anywhere, from
 *  every app they use (each app's quick actions on its home card). */
export function HomeNew({ actions }: { actions: { key: string; label: string; href: string; icon?: HomeIcon }[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button><Plus aria-hidden="true" />New</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-(--pc-overlay-max-width)">
        <DropdownMenuLabel className="text-xs font-semibold text-ui-muted-foreground">New</DropdownMenuLabel>
        {actions.map((action) => {
          const Icon = action.icon ? ACTION_ICONS[action.icon] : Plus;
          return (
            <DropdownMenuItem key={action.key} asChild>
              <Link href={action.href}><Icon aria-hidden="true" />{action.label}</Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
