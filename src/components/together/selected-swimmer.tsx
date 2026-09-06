"use client";

import { useRouter } from "next/navigation";
import { Token } from "@astryxdesign/core/Token";

/** Astryx's linked, removable Token renders the profile link and remove
 * button as siblings, so removing a swimmer never opens their profile. */
export function SelectedSwimmer({
  id,
  name,
  levelName,
  removeHref,
}: {
  id: string;
  name: string;
  levelName: string | null;
  removeHref: string;
}) {
  const router = useRouter();

  return (
    <Token
      size="lg"
      label={`${name} · ${levelName ?? "no level"}`}
      href={`/students/${id}`}
      onRemove={() => router.push(removeHref)}
    />
  );
}
