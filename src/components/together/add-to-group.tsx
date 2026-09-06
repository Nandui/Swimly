"use client";

import { useRouter } from "next/navigation";
import { VStack } from "@astryxdesign/core/Stack";
import { StudentSearch } from "@/components/students/student-search";

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
    <VStack maxWidth={384}>
      <StudentSearch
        exclude={chosen}
        label={chosen.length === 0 ? "Add a child" : "Add another"}
        placeholder="Search swimmers…"
        emptyText="Nobody matches."
        onSelect={(hit) => {
          if (hit) router.push(`/together?students=${[...chosen, hit.id].join(",")}`);
        }}
      />
    </VStack>
  );
}
