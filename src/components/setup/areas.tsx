"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { ArchiveRestore, ArrowDown, ArrowUp, CirclePause, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/shadcn/native-select";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { moveArea, saveArea, saveAreaStaffing, setAreaArchived } from "@/lib/setup/actions";
import { WEEKDAYS, hhmm, type AreaTogether, type WeekHour } from "@/lib/setup/area-staffing";

/** Add an area to a site, or change one: its name, how many lanes it has, whose department it
 *  is and what area it is part of (owner, 20 October 2026: Pool has the 25 m and the 18 m). A
 *  rename reaches every record that uses it; lanes let the rota book a pool whole or by lane. */
export function SaveArea({ siteId, siteName, area, departments, parents }: {
  siteId: string; siteName: string;
  area?: { id: string; name: string; lanes: number; departmentId: string | null; parentId: string | null; hasSubAreas?: boolean };
  departments: { id: string; name: string }[];
  /** The site's open top-level areas it could be part of. */
  parents: { id: string; name: string }[];
}) {
  const id = area ? `area-${area.id}` : `area-new-${siteId}`;
  const [parentId, setParentId] = useState(area?.parentId ?? "");
  const choices = parents.filter((p) => p.id !== area?.id);
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
      onOpen={() => setParentId(area?.parentId ?? "")}
      submit={(formData) => saveArea(siteId, area?.id ?? null, { name: String(formData.get("name") ?? ""), lanes: String(formData.get("lanes") ?? "0"),
        parentId: String(formData.get("parentId") ?? ""), departmentId: String(formData.get("departmentId") ?? "") })}
    >
      <Field label="Name" htmlFor={id}><Input id={id} name="name" required maxLength={60} defaultValue={area?.name} autoFocus /></Field>
      {area?.hasSubAreas ? <input type="hidden" name="parentId" value="" /> : (
        <Field label="Part of" htmlFor={`${id}-parent`} optional hint="For a sub-area, such as the 25 m and 18 m as part of Pool. It belongs to the same department.">
          <NativeSelect id={`${id}-parent`} name="parentId" value={parentId} onChange={(e) => setParentId(e.target.value)} className="min-h-11 w-full">
            <NativeSelectOption value="">Not part of another area</NativeSelectOption>
            {choices.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      )}
      {parentId ? null : (
        <Field label="Department" htmlFor={`${id}-department`} optional hint="Whose area it is: its needs show on that department's plan. Leave it for an area every department shares.">
          <NativeSelect id={`${id}-department`} name="departmentId" defaultValue={area?.departmentId ?? ""} className="min-h-11 w-full">
            <NativeSelectOption value="">Shared by every department</NativeSelectOption>
            {departments.map((d) => <NativeSelectOption key={d.id} value={d.id}>{d.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      )}
      <Field label="Lanes" htmlFor={`${id}-lanes`} hint="For a swimming pool: how many lanes it has, numbered from 1. Rota activities and bookings, swim classes and short courses can then take the whole pool, one lane or a set of lanes. 0 for an area without lanes, such as a gym or reception.">
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

type Minimum = { count: number; typeId: string | null; typeName: string | null; roleId?: string | null; roleName?: string | null;
  activityTypeId?: string | null; from?: number | null; until?: number | null };
/** A role (Admin, Positions) and the qualifications it needs. */
type Role = { id: string; name: string; typeIds: readonly string[]; archived?: boolean };
/** An activity an area's line can ask people to be on, with its department for grouping. */
type ActivityChoice = { id: string; name: string; departmentName: string };
/** A line: a role on duty (roleId, typeId), or people on an activity (activityTypeId and its times). */
type Line = { key: string; count: number; roleId: string; typeId: string; activityTypeId: string; from: number | null; until: number | null };

/** The staff an area needs while it is open (owner requests, 16 October 2026: "the 25 meter pool
 *  has a time to be open, and during that time it will need a specific amount of staff with
 *  specific qualifications"): one line per role it asks for (owner request, 20 October 2026: a pool
 *  needs cover from lifeguards), the qualification that says who can fill it, every day's hours
 *  and any weekday's own. Each line is a need on the rota Plan to put staff on. A line can instead
 *  ask for people on an activity there (owner, 21 October 2026: Reception needs at least one person
 *  on Serving customers), whenever it is open or between its own times. */
export function AreaStaffing({ area, qualifications, activities, roles, others }: {
  area: { id: string; name: string; minimums: Minimum[]; openFrom: number | null; openUntil: number | null; weekHours: WeekHour[]; together: AreaTogether[] };
  qualifications: { id: string; name: string }[];
  /** The organisation's open activities, for lines that ask for people on one. */
  activities: ActivityChoice[];
  roles: Role[];
  /** The site's other open areas, to be covered from. */
  others: { id: string; name: string }[];
}) {
  const start = area.minimums.length ? area.minimums : [{ count: 1, typeId: null, typeName: null, roleId: null }];
  const [lines, setLines] = useState<Line[]>(() => start.map((m, i) => ({ key: String(i), count: m.count, roleId: m.roleId ?? "", typeId: m.typeId ?? "",
    activityTypeId: m.activityTypeId ?? "", from: m.from ?? null, until: m.until ?? null })));
  const qualName = new Map(qualifications.map((q) => [q.id, q.name]));
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  // What the area can be covered for: the types of staff its lines ask for.
  const duty = lines.filter((l) => !l.activityTypeId);
  const kinds = [...new Set(duty.map((l) => l.typeId))].map((typeId) => {
    const named = [...new Set(duty.filter((l) => l.typeId === typeId && l.roleId).map((l) => roleName.get(l.roleId)!))];
    return { typeId, label: named.length ? named.join(" or ") : typeId ? `Holds ${qualName.get(typeId) ?? "a qualification"}` : "Anyone" };
  });
  return (
    <FormDialog
      trigger={<Button variant="outline" size="icon" aria-label={`Staff needed in ${area.name}`}><Users aria-hidden="true" /></Button>}
      title={`Staff needed in ${area.name}`}
      description="While it is open it needs these staff, on top of its bookings. Each role shows on the rota Plan with places to put people on; a line on an activity counts only the people on that activity here or in its parts. Anything short shows under Not covered yet."
      width="sm:max-w-xl"
      submitLabel="Save"
      successMessage="Staff needed saved"
      submit={(formData) => {
        const keys = formData.getAll("line").map(String);
        return saveAreaStaffing(area.id, {
          lines: keys.map((k) => {
            const count = Number(formData.get(`count-${k}`) ?? 0);
            const activityTypeId = String(formData.get(`activity-${k}`) ?? "");
            return activityTypeId
              ? { count, typeId: "", activityTypeId, from: String(formData.get(`from-${k}`) ?? ""), until: String(formData.get(`until-${k}`) ?? "") }
              : { count, roleId: String(formData.get(`role-${k}`) ?? ""), typeId: String(formData.get(`type-${k}`) ?? "") };
          }),
          together: formData.getAll("with").map(String).map((k) => ({ withAreaId: String(formData.get(`with-area-${k}`) ?? ""), count: Number(formData.get(`with-count-${k}`) ?? 0),
            typeId: String(formData.get(`with-type-${k}`) ?? "") })),
          openFrom: String(formData.get("openFrom") ?? ""), openUntil: String(formData.get("openUntil") ?? ""),
          days: WEEKDAYS.flatMap((_, day) => {
            const mode = String(formData.get(`mode-${day}`) ?? "same");
            if (mode === "same") return [];
            return [mode === "closed" ? { day, from: "", until: "" } : { day, from: String(formData.get(`from-${day}`) ?? ""), until: String(formData.get(`until-${day}`) ?? "") }];
          }),
        });
      }}
    >
      <StaffingLines id={`staffing-${area.id}`} lines={lines} setLines={setLines} qualifications={qualifications} roles={roles} activities={activities} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Open every day</legend>
        <div className="grid grid-cols-2 gap-4">
          <Field label="From" htmlFor={`staffing-${area.id}-from`}><Input id={`staffing-${area.id}-from`} name="openFrom" type="time" step={300} defaultValue={hhmm(area.openFrom)} className="min-h-11" /></Field>
          <Field label="Until" htmlFor={`staffing-${area.id}-until`}><Input id={`staffing-${area.id}-until`} name="openUntil" type="time" step={300} defaultValue={hhmm(area.openUntil)} className="min-h-11" /></Field>
        </div>
      </fieldset>
      <WeekHours id={`staffing-${area.id}`} start={area.weekHours} />
      {others.length ? <CoveredFrom id={`staffing-${area.id}`} name={area.name} start={area.together} others={others} kinds={kinds} /> : null}
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
          <div key={name} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
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

/** The lines of what an area needs: how many, and either the role and who can fill it, or the
 *  activity they are on (with its own times, or whenever it is open). Remove every line for none.
 *  Choosing a role fills in the qualification it needs. */
function StaffingLines({ id, lines, setLines, qualifications, roles, activities }: {
  id: string; lines: Line[]; setLines: Dispatch<SetStateAction<Line[]>>; qualifications: { id: string; name: string }[]; roles: Role[]; activities: ActivityChoice[];
}) {
  const [next, setNext] = useState(lines.length);
  const change = (key: string, patch: Partial<Line>) => setLines((all) => all.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  // The role's qualification, in the order Admin lists them; none for a role that needs none.
  const typeOf = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    return role ? qualifications.find((q) => role.typeIds.includes(q.id))?.id ?? "" : "";
  };
  const departments = [...new Set(activities.map((a) => a.departmentName))];
  const add = (line: Omit<Line, "key">) => { setLines((all) => [...all, { key: String(next), ...line }]); setNext((n) => n + 1); };
  const remove = (l: Line, i: number) => (
    <Button type="button" variant="ghost" size="icon" className="mt-6 size-11" aria-label={`Remove line ${i + 1}`} onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))}>
      <Trash2 aria-hidden="true" />
    </Button>
  );
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Staff it needs</legend>
      {lines.length === 0 ? <p className="text-sm text-ui-muted-foreground">No staff needed. Save to take it off the rota, or add a line.</p> : null}
      {lines.map((l, i) => (
        l.activityTypeId ? (
          <div key={l.key} className="grid grid-cols-fill-auto items-start gap-3">
            <input type="hidden" name="line" value={l.key} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="At least" htmlFor={`${id}-count-${l.key}`}>
                <Input id={`${id}-count-${l.key}`} name={`count-${l.key}`} type="number" inputMode="numeric" min={1} max={30} required value={l.count}
                  onChange={(e) => change(l.key, { count: Number(e.target.value) })} className="min-h-11" />
              </Field>
              <div className="sm:col-span-2"><Field label="On the activity" htmlFor={`${id}-activity-${l.key}`}>
                <NativeSelect id={`${id}-activity-${l.key}`} name={`activity-${l.key}`} value={l.activityTypeId} onChange={(e) => change(l.key, { activityTypeId: e.target.value })} className="min-h-11 w-full">
                  {departments.map((d) => (
                    <NativeSelectOptGroup key={d} label={d}>
                      {activities.filter((a) => a.departmentName === d).map((a) => <NativeSelectOption key={a.id} value={a.id}>{a.name}</NativeSelectOption>)}
                    </NativeSelectOptGroup>
                  ))}
                </NativeSelect>
              </Field></div>
              <p className="text-sm text-ui-muted-foreground sm:col-span-3">Between these times, or leave both empty for whenever it is open.</p>
              <Field label="From" htmlFor={`${id}-from-${l.key}`} optional>
                <Input id={`${id}-from-${l.key}`} name={`from-${l.key}`} type="time" step={300} defaultValue={hhmm(l.from)} className="min-h-11" />
              </Field>
              <Field label="Until" htmlFor={`${id}-until-${l.key}`} optional>
                <Input id={`${id}-until-${l.key}`} name={`until-${l.key}`} type="time" step={300} defaultValue={hhmm(l.until)} className="min-h-11" />
              </Field>
            </div>
            {remove(l, i)}
          </div>
        ) : (
        <div key={l.key} className="grid grid-cols-fill-auto items-start gap-3">
          <input type="hidden" name="line" value={l.key} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="How many" htmlFor={`${id}-count-${l.key}`}>
              <Input id={`${id}-count-${l.key}`} name={`count-${l.key}`} type="number" inputMode="numeric" min={1} max={30} required value={l.count}
                onChange={(e) => change(l.key, { count: Number(e.target.value) })} className="min-h-11" />
            </Field>
            <div className="sm:col-span-2"><Field label="Role" htmlFor={`${id}-role-${l.key}`}>
              <NativeSelect id={`${id}-role-${l.key}`} name={`role-${l.key}`} value={l.roleId} onChange={(e) => change(l.key, { roleId: e.target.value, typeId: e.target.value ? typeOf(e.target.value) : l.typeId })} className="min-h-11 w-full">
                <NativeSelectOption value="">Any role</NativeSelectOption>
                {roles.filter((r) => !r.archived || r.id === l.roleId).map((r) => <NativeSelectOption key={r.id} value={r.id}>{r.name}</NativeSelectOption>)}
              </NativeSelect>
            </Field></div>
            <div className="sm:col-span-3"><Field label="Who can fill it" htmlFor={`${id}-type-${l.key}`} hint={l.roleId ? "Set from what the role needs in Admin > Positions. Change it only if this area needs something else." : undefined}>
              <NativeSelect id={`${id}-type-${l.key}`} name={`type-${l.key}`} value={l.typeId} onChange={(e) => change(l.key, { typeId: e.target.value })} className="min-h-11 w-full">
                <NativeSelectOption value="">Anyone</NativeSelectOption>
                {qualifications.map((q) => <NativeSelectOption key={q.id} value={q.id}>Holds {q.name}</NativeSelectOption>)}
              </NativeSelect>
            </Field></div>
          </div>
          {remove(l, i)}
        </div>
        )
      ))}
      {roles.length === 0 ? <p className="text-sm text-ui-muted-foreground">Add roles such as Lifeguard under Admin &gt; Positions to ask for them here.</p> : null}
      {lines.length < 12 ? (
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => add({ count: 1, roleId: "", typeId: "", activityTypeId: "", from: null, until: null })}>
            <Plus aria-hidden="true" />Add a role
          </Button>
          {activities.length ? (
            <Button type="button" variant="outline" onClick={() => add({ count: 1, roleId: "", typeId: "", activityTypeId: activities[0].id, from: null, until: null })}>
              <Plus aria-hidden="true" />Add people on an activity
            </Button>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}

/** Staff in another area covering this one while both are open (owner request, 16 October 2026:
 *  one lifeguard by the door between the main hall and the 18 m pool). */
function CoveredFrom({ id, name, start, others, kinds }: { id: string; name: string; start: AreaTogether[]; others: { id: string; name: string }[]; kinds: { typeId: string; label: string }[] }) {
  const [rows, setRows] = useState(() => start.map((t, i) => ({ key: String(i), ...t })));
  const [next, setNext] = useState(start.length);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Covered from another area</legend>
      <p className="text-sm text-ui-muted-foreground">
        When staff in another area can watch {name} too, such as a lifeguard by the door between two pools. While both are open, {name} needs none of that role and the other area needs this many in all.
      </p>
      {rows.map((r, i) => (
        <div key={r.key} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-three-fields-action">
          <input type="hidden" name="with" value={r.key} />
          <Field label="While open with" htmlFor={`${id}-with-area-${r.key}`}>
            <NativeSelect id={`${id}-with-area-${r.key}`} name={`with-area-${r.key}`} defaultValue={r.withAreaId} required className="min-h-11 w-full">
              {others.map((o) => <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field label="Staff in all" htmlFor={`${id}-with-count-${r.key}`}>
            <Input id={`${id}-with-count-${r.key}`} name={`with-count-${r.key}`} type="number" inputMode="numeric" min={1} max={30} required defaultValue={r.count} className="min-h-11" />
          </Field>
          <Field label="Role" htmlFor={`${id}-with-type-${r.key}`}>
            <NativeSelect id={`${id}-with-type-${r.key}`} name={`with-type-${r.key}`} defaultValue={r.typeId ?? kinds[0]?.typeId ?? ""} className="min-h-11 w-full">
              {kinds.map((k) => <NativeSelectOption key={k.typeId} value={k.typeId}>{k.label}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Remove covered from ${i + 1}`} onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}>
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      ))}
      {rows.length < 4 && kinds.length ? (
        <Button type="button" variant="outline" className="self-start" onClick={() => { setRows((all) => [...all, { key: String(next), withAreaId: others[0].id, count: 1, typeId: null }]); setNext((n) => n + 1); }}>
          <Plus aria-hidden="true" />Add an area that covers it
        </Button>
      ) : null}
    </fieldset>
  );
}
