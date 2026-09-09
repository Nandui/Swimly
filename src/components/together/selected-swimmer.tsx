"use client";

import { useRouter } from "next/navigation";
import { Token } from "@/components/workspace/misc";


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
