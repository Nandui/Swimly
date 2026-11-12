"use client";

import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";

/** Pick one of a site's areas (kept in Admin, Areas), for any module's "where" field. A value
 *  saved before the list existed, or since archived, stays choosable so editing never loses it. */
export function AreaSelect({ id, name, areas, defaultValue, required = false, emptyLabel = "Not set" }: {
  id: string; name: string; areas: readonly string[]; defaultValue?: string | null; required?: boolean; emptyLabel?: string;
}) {
  const current = (defaultValue ?? "").trim();
  const extra = current && !areas.some((a) => a.toLowerCase() === current.toLowerCase()) ? current : null;
  return (
    <NativeSelect id={id} name={name} defaultValue={current} required={required} className="min-h-11 w-full">
      <NativeSelectOption value="">{areas.length ? emptyLabel : "No areas yet (Admin, Areas)"}</NativeSelectOption>
      {areas.map((a) => <NativeSelectOption key={a} value={a}>{a}</NativeSelectOption>)}
      {extra ? <NativeSelectOption value={extra}>{extra} (not on the list)</NativeSelectOption> : null}
    </NativeSelect>
  );
}
