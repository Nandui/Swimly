"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { StudentSearch } from "@/components/students/student-search";
import { cn } from "@/lib/utils";

/** Adds one more swimmer to the group.
 *
 *  Adds rather than selects: the group is built by hand, because the app has no
 *  way of knowing that two children are friends and no business guessing.
 *
 *  Searches the server rather than a list it was handed — over a thousand
 *  swimmers, and this page used to carry all of them so that one could be
 *  picked. Anyone already in the group is left out of the answers, so the only
 *  thing it offers is a thing that would change something. */
export function AddToGroup({ chosen }: { chosen: string[] }) {
  const router = useRouter();

  return (
    <StudentSearch
      exclude={chosen}
      placeholder="Search swimmers…"
      emptyText="Nobody matches."
      onSelect={(hit) => router.push(`/together?students=${[...chosen, hit.id].join(",")}`)}
      trigger={
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed px-2.5 text-[13px]",
            "text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground",
            "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          )}
        >
          <Plus className="size-3.5" aria-hidden />
          {chosen.length === 0 ? "Add a child" : "Add another"}
        </button>
      }
    />
  );
}
