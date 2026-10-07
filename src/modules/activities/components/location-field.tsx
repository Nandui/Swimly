"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { workingSiteAreas } from "@/modules/activities/lib/areas";
import { joinLocation, splitLocation } from "@/lib/setup/meta";

/** Where a class or an assessment is: one of the working site's areas (kept in Admin, Areas)
 *  and an optional detail such as the lane. Saved as one location, "Learner pool, lane 3", as
 *  before, so nothing that reads it changes. A location from before the list stays as it was. */
export function LocationField({ id = "location", name = "location", defaultValue, label = "Where", detailPlaceholder = "Lane 3" }: {
  id?: string; name?: string; defaultValue?: string | null; label?: string; detailPlaceholder?: string;
}) {
  const [areas, setAreas] = useState<string[] | null>(null);
  const [area, setArea] = useState("");
  const [detail, setDetail] = useState(defaultValue ?? "");
  useEffect(() => {
    let live = true;
    workingSiteAreas().then((list) => {
      if (!live) return;
      const split = splitLocation(defaultValue, list);
      setAreas(list); setArea(split.area); setDetail(split.detail);
    }).catch(() => { if (live) setAreas([]); });
    return () => { live = false; };
  }, [defaultValue]);
  const value = joinLocation(area, detail);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label} <span className="font-normal text-ui-muted-foreground">(optional)</span></Label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <NativeSelect id={id} value={area} onChange={(e) => setArea(e.target.value)} disabled={areas === null} aria-label={`${label}: area`}>
          <NativeSelectOption value="">{areas === null ? "Loading areas…" : areas.length ? "Choose an area" : "No areas yet (Admin, Areas)"}</NativeSelectOption>
          {(areas ?? []).map((a) => <NativeSelectOption key={a} value={a}>{a}</NativeSelectOption>)}
        </NativeSelect>
        <Input value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={60} placeholder={detailPlaceholder} aria-label={`${label}: detail, such as the lane`} />
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
