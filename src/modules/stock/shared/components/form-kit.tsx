"use client";

import { useRouter } from "next/navigation";
import { Tag } from "@/components/ui-kit/tag";
import { categoryTone } from "@/modules/stock/shared/rules";

/** What Stock's screens share. Every dialog is a FormDialog, so a refusal keeps
 *  the typing and shows the sentence beside the fields. */

export const THEME = "turnfin-module";
export const text = (fd: FormData, key: string) => String(fd.get(key) ?? "");

export function useRefresh() {
  const router = useRouter();
  return () => router.refresh();
}

/** A category as a tag in its tone. */
export function CategoryTag({ name, tone }: { name: string; tone: string }) {
  return <Tag meta={categoryTone(tone)} label={name} />;
}
