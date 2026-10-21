"use client";

import { useRouter } from "next/navigation";

import { togetherHref, type WhatIf } from "@/modules/activities/features/together/href";
import { StudentSearch } from "@/modules/activities/shared/students/components/student-search";

/** Adds one more swimmer to the group.
 *
 *  Adds rather than selects: the group is built by hand, because the app has no
 *  way of knowing that two children are friends and no business guessing.
 *
 *  Searches the server rather than a list it was handed — over a thousand
 *  swimmers, and this page used to carry all of them so that one could be
 *  picked. Anyone already in the group is left out of the answers, so the only
 *  thing it offers is a thing that would change something. Any what-if levels stay. */
export function AddToGroup({ chosen, whatIf = {} }: { chosen: string[]; whatIf?: WhatIf }) {
  const router = useRouter();

  return (
    <div className="min-w-0 flex w-full flex-col gap-4 sm:max-w-sm">
      <StudentSearch
        exclude={chosen}
        label={chosen.length === 0 ? "Add a swimmer" : "Add another swimmer"}
        placeholder="Search swimmers"
        emptyText="Nobody matches."
        onSelect={(hit) => {
          if (hit)
            router.push(togetherHref([...chosen, hit.id], whatIf), { scroll: false });
        }}
      />
    </div>
  );
}
