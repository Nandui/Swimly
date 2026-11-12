"use client";

import { useState } from "react";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Field } from "@/components/form-dialog";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { joinLocation, laneDetail, lanesInDetail, lanesLabel, splitLocation } from "@/lib/setup/lanes";

/** One of a site's areas and how many lanes it has (Admin, Areas; 0 for none). */
export type AreaWithLanes = { name: string; lanes: number };

/** A pool's lanes to tick (owner requests, 13 and 19 October 2026): the whole pool, one lane or
 *  any set of them. None ticked is the whole pool. */
export function LanePicker({ fid, count, chosen, onChange }: { fid: string; count: number; chosen: readonly number[]; onChange: (lanes: number[]) => void }) {
  const shown = chosen.filter((l) => l <= count);
  const toggle = (lane: number, on: boolean) => onChange(on ? [...shown, lane].sort((a, b) => a - b) : shown.filter((l) => l !== lane));
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 sm:col-span-2">
      <legend className="mb-2 font-semibold">Lanes <span className="font-normal text-ui-muted-foreground">({lanesLabel(shown, count)})</span></legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <div className="flex min-h-11 items-center gap-2">
          <Checkbox id={`${fid}-whole`} checked={shown.length === 0} onCheckedChange={(v) => { if (v === true) onChange([]); }} />
          <Label htmlFor={`${fid}-whole`} className="font-normal">Whole pool</Label>
        </div>
        {Array.from({ length: count }, (_, i) => i + 1).map((lane) => (
          <div key={lane} className="flex min-h-11 items-center gap-2">
            <Checkbox id={`${fid}-lane-${lane}`} checked={shown.includes(lane)} onCheckedChange={(v) => toggle(lane, v === true)} />
            <Label htmlFor={`${fid}-lane-${lane}`} className="font-normal">Lane {lane}</Label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

/** "Where" saved as one location text, for a module that keeps it that way (swim classes,
 *  assessments, short course sessions): one of the site's areas, and in a pool with lanes the
 *  lanes it takes, saved after the area as before ("Main pool, lanes 1 to 3"). `detail` adds a
 *  box for other words after it ("shallow end"). A location from before the list stays as it was.
 *  Sits in a two-column grid, the lanes taking the full width under it. `areas` is null while
 *  they load. */
export function PlaceLanesField(props: {
  fid: string; name: string; areas: readonly AreaWithLanes[] | null; defaultValue?: string | null; label?: string; hint?: string;
  detail?: boolean; detailPlaceholder?: string;
}) {
  if (props.areas === null) {
    return (
      <Field label={props.label ?? "Where"} htmlFor={`${props.fid}-area`} optional hint={props.hint}>
        <NativeSelect id={`${props.fid}-area`} disabled className="min-h-11 w-full"><NativeSelectOption value="">Loading areas…</NativeSelectOption></NativeSelect>
      </Field>
    );
  }
  return <PlaceLanes {...props} areas={props.areas} />;
}

function PlaceLanes({ fid, name, areas, defaultValue, label = "Where", hint, detail = false, detailPlaceholder = "Shallow end" }: {
  fid: string; name: string; areas: readonly AreaWithLanes[]; defaultValue?: string | null; label?: string; hint?: string;
  detail?: boolean; detailPlaceholder?: string;
}) {
  const names = areas.map((a) => a.name);
  const lanesOf = (a: string) => areas.find((x) => x.name === a)?.lanes ?? 0;
  const start = splitLocation(defaultValue, names);
  // The lane words come out of the detail only in a pool with lanes; elsewhere it stays as typed.
  const startLanes = lanesOf(start.area) ? lanesInDetail(start.detail) : { lanes: [], rest: start.detail };
  const [area, setArea] = useState(start.area);
  const [lanes, setLanes] = useState<number[]>(startLanes.lanes);
  const [rest, setRest] = useState(startLanes.rest);
  // A location not on the list (typed before it, or an area since archived) is kept unless changed.
  const [kept, setKept] = useState(defaultValue?.trim() && !start.area ? defaultValue.trim() : null);
  const count = lanesOf(area);
  const words = detail ? rest : "";
  const value = kept ?? joinLocation(area, count ? laneDetail(lanes, count, words) : words);
  return (
    <>
      <Field label={label} htmlFor={`${fid}-area`} optional hint={hint}>
        <NativeSelect id={`${fid}-area`} value={kept ? "-kept" : area} className="min-h-11 w-full"
          onChange={(e) => { if (e.target.value === "-kept") return; setKept(null); setArea(e.target.value); setLanes([]); }}>
          <NativeSelectOption value="">{names.length ? "Not set" : "No areas yet (Admin, Areas)"}</NativeSelectOption>
          {names.map((a) => <NativeSelectOption key={a} value={a}>{a}</NativeSelectOption>)}
          {kept ? <NativeSelectOption value="-kept">{kept} (not on the list)</NativeSelectOption> : null}
        </NativeSelect>
      </Field>
      {detail ? (
        <Field label="Detail" htmlFor={`${fid}-detail`} optional>
          <Input id={`${fid}-detail`} value={rest} onChange={(e) => setRest(e.target.value)} maxLength={60} placeholder={count ? detailPlaceholder : "Lane 3"} disabled={Boolean(kept)} className="min-h-11" />
        </Field>
      ) : null}
      {count && !kept ? <LanePicker fid={fid} count={count} chosen={lanes} onChange={setLanes} /> : null}
      <input type="hidden" name={name} value={value} />
    </>
  );
}
