"use client";

import { useRouter } from "next/navigation";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";

/** What the dialogs share, for short courses and Academy courses alike (docs/short-courses.md). Every dialog is a FormDialog, so a refusal
 *  keeps the typing and shows the sentence beside the fields. */

export const THEME = "turnfin-module";
export const text = (fd: FormData, key: string) => String(fd.get(key) ?? "");
export const amount = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, "");
export type Option = { id: string; name: string };
export type Person = { id: string; name: string; jobTitle?: string | null };

export function useRefresh() {
  const router = useRouter();
  return () => router.refresh();
}

export function PersonSelect({ id, name, people, defaultValue, optional }: { id: string; name: string; people: Person[]; defaultValue?: string | null; optional?: string }) {
  return (
    <NativeSelect id={id} name={name} defaultValue={defaultValue ?? ""} required={!optional} className="min-h-11 w-full">
      <NativeSelectOption value="">{optional ?? "Choose someone"}</NativeSelectOption>
      {people.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.name}{p.jobTitle ? ` · ${p.jobTitle}` : ""}</NativeSelectOption>)}
    </NativeSelect>
  );
}
