"use client";

import { useState } from "react";
import { ArchiveRestore, ArrowDown, ArrowUp, CirclePause, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { moveArea, saveArea, saveAreaStaffing, setAreaArchived } from "@/lib/setup/actions";
import { WEEKDAYS, hhmm, type WeekHour } from "@/lib/setup/area-staffing";

/** Add an area to a site, or change one: its name and how many lanes it has. A rename reaches
 *  every record that uses it; lanes let the rota book a pool whole or by lane. */
export function SaveArea({ siteId, siteName, area }: { siteId: string; siteName: string; area?: { id: string; name: string; lanes: number } }) {
  const id = area ? `area-${area.id}` : `area-new-${siteId}`;
  return (
    <FormDialog
      trigger={area
        ? <Button variant="outline" size="icon" aria-label={`Change ${area.name}`}><Pencil aria-hidden="true" /></Button>
        : <Button variant="outline"><Plus aria-hidden="true" />Add an area</Button>}
      title={area ? `Change ${area.name}` : `Add an area at ${siteName}`}
      description={area
        ? "The rota's activities and bookings and the swim school's classes that use it are renamed with it."
        : "A place at the site where work happens, such as 25m pool, Learner pool, Gym or Reception."}
      submitLabel={area ? "Save area" : "Add area"}
      successMessage={area ? "Area saved" : "Area added"}
      submit={(formData) => saveArea(siteId, area?.id ?? null, { name: String(formData.get("name") ?? ""), lanes: String(formData.get("lanes") ?? "0") })}
    >
      <Field label="Name" htmlFor={id}><Input id={id} name="name" required maxLength={60} defaultValue={area?.name} autoFocus /></Field>
      <Field label="Lanes" htmlFor={`${id}-lanes`} hint="For a pool booked by lane. 0 for an area without lanes, such as a gym or reception.">
        <Input id={`${id}-lanes`} name="lanes" type="number" inputMode="numeric" min={0} max={20} required defaultValue={area?.lanes ?? 0} className="min-h-11" />
      </Field>
    </FormDialog>
  );
}

export function ArchiveArea({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  if (archived) {
    return <ActionButton ariaLabel={`Restore ${name}`} successMessage="Area restored" run={() => setAreaArchived(id, false)}><ArchiveRestore aria-hidden="true" /></ActionButton>;
  }
  return (
    <ConfirmAction
      trigger={<Button variant="outline" size="icon" aria-label={`Archive ${name}`}><CirclePause aria-hidden="true" /></Button>}
      title={`Archive ${name}?`}
      description="It is no longer offered when planning or adding classes. Anything already using it keeps the name. You can restore it later."
      confirmLabel="Archive"
      successMessage="Area archived"
      run={() => setAreaArchived(id, true)}
    />
  );
}

/** Up and down: the order every module offers a site's areas in. */
export function MoveArea({ id, name, first, last }: { id: string; name: string; first: boolean; last: boolean }) {
  return (
    <>
      <ActionButton ariaLabel={`Move ${name} up`} successMessage="Moved" disabled={first} run={() => moveArea(id, "up")}><ArrowUp aria-hidden="true" /></ActionButton>
      <ActionButton ariaLabel={`Move ${name} down`} successMessage="Moved" disabled={last} run={() => moveArea(id, "down")}><ArrowDown aria-hidden="true" /></ActionButton>
    </>
  );
}

type Minimum = { count: number; typeId: string | null; typeName: string | null };

/** The staff an area needs while it is open (owner requests, 16 October 2026: "the 25 meter pool
 *  has a time to be open, and during that time it will need a specific amount of staff with
 *  specific qualifications"): one line per type of staff, a qualification they hold or anyone,
 *  every day's hours and any weekday's own. Each line is a need on the rota Plan to put staff on. */
export function AreaStaffing({ area, qualifications }: {
  area: { id: string; name: string; minimums: Minimum[]; openFrom: number | null; openUntil: number | null; weekHours: WeekHour[] };
  qualifications: { id: string; name: string }[];
}) {
  const start = area.minimums.length ? area.minimums : [{ count: 1, typeId: null, typeName: null }];
  return (
    <FormDialog
      trigger={<Button variant="outline" size="icon" aria-label={`Staff needed in ${area.name}`}><Users aria-hidden="true" /></Button>}
      title={`Staff needed in ${area.name}`}
      description="While it is open it needs these staff, on top of its bookings and activities. Each type of staff shows on the rota Plan with places to put people on."
      width="sm:max-w-xl"
      submitLabel="Save"
      successMessage="Staff needed saved"
      submit={(formData) => {
        const keys = formData.getAll("line").map(String);
        return saveAreaStaffing(area.id, {
          lines: keys.map((k) => ({ count: Number(formData.get(`count-${k}`) ?? 0), typeId: String(formData.get(`type-${k}`) ?? "") })),
          openFrom: String(formData.get("openFrom") ?? ""), openUntil: String(formData.get("openUntil") ?? ""),
          days: WEEKDAYS.flatMap((_, day) => {
            const mode = String(formData.get(`mode-${day}`) ?? "same");
            if (mode === "same") return [];
            return [mode === "closed" ? { day, from: "", until: "" } : { day, from: String(formData.get(`from-${day}`) ?? ""), until: String(formData.get(`until-${day}`) ?? "") }];
          }),
        });
      }}
    >
      <StaffingLines id={`staffing-${area.id}`} start={start} qualifications={qualifications} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Open every day</legend>
        <div className="grid grid-cols-2 gap-4">
          <Field label="From" htmlFor={`staffing-${area.id}-from`}><Input id={`staffing-${area.id}-from`} name="openFrom" type="time" step={300} defaultValue={hhmm(area.openFrom)} className="min-h-11" /></Field>
          <Field label="Until" htmlFor={`staffing-${area.id}-until`}><Input id={`staffing-${area.id}-until`} name="openUntil" type="time" step={300} defaultValue={hhmm(area.openUntil)} className="min-h-11" /></Field>
        </div>
      </fieldset>
      <WeekHours id={`staffing-${area.id}`} start={area.weekHours} />
    </FormDialog>
  );
}

/** A weekday's own hours, or closed; the rest keep every day's. */
function WeekHours({ id, start }: { id: string; start: WeekHour[] }) {
  const [modes, setModes] = useState<string[]>(() => WEEKDAYS.map((_, day) => {
    const own = start.find((w) => w.day === day);
    return !own ? "same" : own.from === null ? "closed" : "own";
  }));
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Different on some days</legend>
      {WEEKDAYS.map((name, day) => {
        const own = start.find((w) => w.day === day);
        const mode = modes[day];
        return (
          <div key={name} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Field label={name} htmlFor={`${id}-mode-${day}`}>
              <NativeSelect id={`${id}-mode-${day}`} name={`mode-${day}`} value={mode} onChange={(e) => setModes((all) => all.map((m, i) => (i === day ? e.target.value : m)))} className="min-h-11 w-full">
                <NativeSelectOption value="same">Every day&apos;s hours</NativeSelectOption>
                <NativeSelectOption value="own">Its own hours</NativeSelectOption>
                <NativeSelectOption value="closed">Closed</NativeSelectOption>
              </NativeSelect>
            </Field>
            {mode === "own" ? <>
              <Field label="From" htmlFor={`${id}-from-${day}`}><Input id={`${id}-from-${day}`} name={`from-${day}`} type="time" step={300} required defaultValue={hhmm(own?.from ?? null)} className="min-h-11" /></Field>
              <Field label="Until" htmlFor={`${id}-until-${day}`}><Input id={`${id}-until-${day}`} name={`until-${day}`} type="time" step={300} required defaultValue={hhmm(own?.until ?? null)} className="min-h-11" /></Field>
            </> : null}
          </div>
        );
      })}
    </fieldset>
  );
}

/** The lines of what an area needs: how many, and which type of staff. Remove every line for none. */
function StaffingLines({ id, start, qualifications }: { id: string; start: Minimum[]; qualifications: { id: string; name: string }[] }) {
  const [lines, setLines] = useState(() => start.map((m, i) => ({ key: String(i), ...m })));
  const [next, setNext] = useState(start.length);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Staff it needs</legend>
      {lines.length === 0 ? <p className="text-sm text-ui-muted-foreground">No staff needed. Save to take it off the rota, or add a line.</p> : null}
      {lines.map((l, i) => (
        <div key={l.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-end gap-3">
          <input type="hidden" name="line" value={l.key} />
          <Field label="How many" htmlFor={`${id}-count-${l.key}`}>
            <Input id={`${id}-count-${l.key}`} name={`count-${l.key}`} type="number" inputMode="numeric" min={1} max={30} required defaultValue={l.count} className="min-h-11" />
          </Field>
          <Field label="Type of staff" htmlFor={`${id}-type-${l.key}`}>
            <NativeSelect id={`${id}-type-${l.key}`} name={`type-${l.key}`} defaultValue={l.typeId ?? ""} className="min-h-11 w-full">
              <NativeSelectOption value="">Anyone</NativeSelectOption>
              {qualifications.map((q) => <NativeSelectOption key={q.id} value={q.id}>Holds {q.name}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Remove line ${i + 1}`} onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))}>
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      ))}
      {lines.length < 8 ? (
        <Button type="button" variant="outline" className="self-start" onClick={() => { setLines((all) => [...all, { key: String(next), count: 1, typeId: null, typeName: null }]); setNext((n) => n + 1); }}>
          <Plus aria-hidden="true" />Add a type of staff
        </Button>
      ) : null}
    </fieldset>
  );
}
