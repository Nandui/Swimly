"use client";

import { useState } from "react";
import { Field } from "@/components/form-dialog";
import { AreaSelect } from "@/components/ui/area-select";
import { LanePicker } from "@/components/ui/lane-picker";

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
      {count ? <LanePicker fid={fid} count={count} chosen={chosen} onChange={setChosen} /> : null}
      {shown.map((l) => <input key={l} type="hidden" name="lanes" value={l} />)}
    </>
  );
}
