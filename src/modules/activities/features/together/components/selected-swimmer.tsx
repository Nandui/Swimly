"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/shadcn/item";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Tag } from "@/components/ui-kit/tag";
import { WHAT_IF_META } from "@/modules/activities/features/together/constants";
import { togetherHref, type WhatIf } from "@/modules/activities/features/together/href";
import type { LevelOption } from "@/modules/activities/features/together/server/match";

const NOW = "now";

/** One swimmer in the group: who they are, the level they are at now, and the level to search
 *  them at. "Their level now" is how Together has always searched; another level is a what-if,
 *  kept in the address and never saved to the swimmer. The profile link and the remove button
 *  are siblings, so each has one unambiguous action. */
export function SelectedSwimmer({ swimmer, group, whatIf, levels }: {
  swimmer: { id: string; name: string; levelName: string | null; levelIds: string[] };
  /** Everyone in the group, in order, to build the addresses. */
  group: string[];
  whatIf: WhatIf;
  levels: LevelOption[];
}) {
  const router = useRouter();
  const assumed = levels.find((level) => level.id === whatIf[swimmer.id]);
  const programmes = [...new Set(levels.map((level) => level.programme))];

  function choose(value: string) {
    const next = { ...whatIf };
    // Their own (only) level is the same search as "now", so it is not a what-if.
    if (value === NOW || (swimmer.levelIds.length === 1 && swimmer.levelIds[0] === value)) delete next[swimmer.id];
    else next[swimmer.id] = value;
    router.push(togetherHref(group, next), { scroll: false });
  }

  return (
    <Item variant="outline" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle>
          <Link href={`/students/${swimmer.id}`} className="hover:underline">{swimmer.name}</Link>
        </ItemTitle>
        <ItemDescription>
          {swimmer.levelName ? `Now in ${swimmer.levelName}` : "No class level yet"}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="w-full flex-wrap sm:w-auto">
        {assumed ? <Tag meta={WHAT_IF_META} /> : null}
        <Select value={assumed?.id ?? NOW} onValueChange={choose}>
          <SelectTrigger aria-label={`Level to search ${swimmer.name} at`} className="min-w-0 flex-1 sm:w-56 sm:flex-none">
            <SelectValue>{assumed ? `As ${assumed.name}` : "Their level now"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NOW}>
              Their level now{swimmer.levelName ? ` (${swimmer.levelName})` : ""}
            </SelectItem>
            <SelectSeparator />
            {programmes.map((programme) => (
              <SelectGroup key={programme}>
                <SelectLabel>{programmes.length > 1 ? programme : "What if they were in"}</SelectLabel>
                {levels.filter((level) => level.programme === programme).map((level) => (
                  <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <Button asChild variant="ghost" size="icon">
          <Link href={togetherHref(group.filter((id) => id !== swimmer.id), whatIf)} aria-label={`Remove ${swimmer.name} from this group`}>
            <X aria-hidden="true" />
          </Link>
        </Button>
      </ItemActions>
    </Item>
  );
}
