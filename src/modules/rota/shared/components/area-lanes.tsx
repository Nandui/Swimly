"use client";

import { useState } from "react";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Label } from "@/components/shadcn/label";
import { Field } from "@/components/form-dialog";
import { AreaSelect } from "@/components/ui/area-select";
import { lanesLabel } from "@/modules/rota/shared/lanes";

/** One of a site's areas and how many lanes it has (Admin, Areas; 0 for none). */
export type AreaLanes = { name: string; lanes: number };

/** "Where" for an activity or a booking, and, in a pool with lanes, which lanes it takes (owner
 *  request, 13 October 2026): the whole pool, one lane or any set of them. Sends `place` and one
 *  `lanes` value per lane chosen; none chosen is the whole area. Sits in a two-column grid, the
 *  lanes taking the full width under it. */
export function AreaLanesFields({ fid, areas, place, lanes, hint = "The site's areas, kept in Admin." }: {
  fid: string; areas: readonly AreaLanes[]; place?: string | null; lanes?: readonly number[]; hint?: string;
}) {
  const [where, setWhere] = useState(place ?? "");
  const [chosen, setChosen] = useState<number[]>([...(lanes ?? [])]);
  const count = areas.find((a) => a.name.toLowerCase() === where.trim().toLowerCase())?.lanes ?? 0;
  const shown = chosen.filter((l) => l <= count);
  const whole = shown.length === 0;
  const toggle = (lane: number, on: boolean) => setChosen((list) => (on ? [...list.filter((l) => l <= count), lane].sort((a, b) => a - b) : list.filter((l) => l !== lane)));
  return (
    <>
      <div className="contents" onChange={(e) => {
        const target = e.target as unknown as HTMLSelectElement;
        if (target.name === "place") { setWhere(target.value); setChosen([]); }
      }}>
        <Field label="Where" htmlFor={`${fid}-place`} optional hint={hint}>
          <AreaSelect id={`${fid}-place`} name="place" areas={areas.map((a) => a.name)} defaultValue={place} />
        </Field>
      </div>
      {count ? (
        <fieldset className="flex min-w-0 flex-col gap-2 sm:col-span-2">
          <legend className="mb-2 font-semibold">Lanes <span className="font-normal text-ui-muted-foreground">({lanesLabel(shown, count)})</span></legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <div className="flex min-h-11 items-center gap-2">
              <Checkbox id={`${fid}-whole`} checked={whole} onCheckedChange={(v) => { if (v === true) setChosen([]); }} />
              <Label htmlFor={`${fid}-whole`} className="font-normal">Whole pool</Label>
            </div>
            {Array.from({ length: count }, (_, i) => i + 1).map((lane) => (
              <div key={lane} className="flex min-h-11 items-center gap-2">
                <Checkbox id={`${fid}-lane-${lane}`} checked={shown.includes(lane)} onCheckedChange={(v) => toggle(lane, v === true)} />
                <Label htmlFor={`${fid}-lane-${lane}`} className="font-normal">Lane {lane}</Label>
              </div>
            ))}
          </div>
          {shown.map((l) => <input key={l} type="hidden" name="lanes" value={l} />)}
        </fieldset>
      ) : null}
    </>
  );
}
