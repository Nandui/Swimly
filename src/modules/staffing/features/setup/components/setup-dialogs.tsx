"use client";

import { Pencil, Plus } from "lucide-react";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { formatTime } from "@/lib/format";
import { archiveSlot, deleteSeason, saveSeason, saveSettings, saveSlot, saveTeacher } from "@/modules/staffing/features/setup/server/actions";
import { NUMBERS, TIMES } from "@/modules/staffing/features/setup/fields";
import { checked, text, THEME, useRefresh } from "@/modules/staffing/shared/components/kit";
import {
  COLLEGE_META, COLLEGES, CONTRACT_KIND_META, CONTRACT_KINDS, SEASON_LABEL, SEASON_NAMES, SLOT_ROLE_META, SLOT_ROLES, WEEKDAY_SHORT,
  type College, type ContractKind, type SeasonName, type SlotRole, type StaffingSettings,
} from "@/modules/staffing/shared/rules";

const pad = (min: number) => formatTime(min);

export type SlotEdit = { id: string; weekday: number; role: string; name: string; startMin: number; endMin: number; needed: number; hardToFill: boolean };

export function SlotDialog({ siteId, slot }: { siteId: string; slot?: SlotEdit }) {
  const refresh = useRefresh();
  const fid = slot ? `stf-slot-${slot.id}` : "stf-slot-new";
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={slot ? <Button variant="outline" size="icon" aria-label={`Change ${slot.name}`}><Pencil aria-hidden="true" /></Button> : <Button><Plus aria-hidden="true" />Add a slot</Button>}
      title={slot ? `Change ${slot.name}` : "Add a slot"} description="A weekly place to fill. New blocks take their places from the slots."
      submitLabel="Save slot" successMessage="Slot saved" onSuccess={refresh}
      submit={(fd) => saveSlot(siteId, slot?.id ?? null, {
        name: text(fd, "name"), weekdays: fd.getAll("weekday").map(String).map(Number), role: text(fd, "role") as SlotRole,
        start: text(fd, "start"), end: text(fd, "end"), needed: text(fd, "needed"), hardToFill: checked(fd, "hardToFill"),
      })}>
      <Field label="Name" htmlFor={`${fid}-name`}><Input id={`${fid}-name`} name="name" required minLength={2} maxLength={60} defaultValue={slot?.name} placeholder="School morning" className="min-h-11" /></Field>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">{slot ? "Day" : "Days"}</legend>
        {slot ? (
          <RadioGroup name="weekday" defaultValue={String(slot.weekday)} className="flex flex-wrap gap-3" aria-label="Day">
            {WEEKDAY_SHORT.map((d, i) => <Label key={d} className="flex min-h-11 items-center gap-2"><RadioGroupItem value={String(i + 1)} />{d}</Label>)}
          </RadioGroup>
        ) : (
          <div className="flex flex-wrap gap-3">
            {WEEKDAY_SHORT.map((d, i) => <Label key={d} className="flex min-h-11 items-center gap-2"><Checkbox name="weekday" value={String(i + 1)} />{d}</Label>)}
          </div>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor={`${fid}-start`}><Input id={`${fid}-start`} name="start" type="time" required defaultValue={slot ? pad(slot.startMin) : "10:15"} className="min-h-11" /></Field>
        <Field label="Ends" htmlFor={`${fid}-end`}><Input id={`${fid}-end`} name="end" type="time" required defaultValue={slot ? pad(slot.endMin) : "13:15"} className="min-h-11" /></Field>
        <Field label="Role" htmlFor={`${fid}-role`}>
          <NativeSelect id={`${fid}-role`} name="role" defaultValue={slot?.role ?? "teaching"} className="min-h-11 w-full">
            {SLOT_ROLES.map((r) => <NativeSelectOption key={r} value={r}>{SLOT_ROLE_META[r].label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="People needed" htmlFor={`${fid}-needed`}><Input id={`${fid}-needed`} name="needed" type="number" inputMode="numeric" min={1} max={30} required defaultValue={slot?.needed ?? 1} className="min-h-11" /></Field>
      </div>
      <Label className="flex min-h-11 items-center gap-3"><Checkbox name="hardToFill" defaultChecked={slot?.hardToFill} />Hard to fill</Label>
    </FormDialog>
  );
}

export function ArchiveSlot({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} trigger={<Button variant="ghost">{archived ? "Restore" : "Archive"}</Button>} title={archived ? `Restore ${name}?` : `Archive ${name}?`}
      description={archived ? "New blocks take places from it again." : "New blocks no longer take places from it. Blocks already started keep theirs."}
      submitLabel={archived ? "Restore" : "Archive"} successMessage={archived ? "Slot restored" : "Slot archived"} onSuccess={refresh} submit={() => archiveSlot(id, !archived)}>
      <p className="text-sm text-ui-muted-foreground">Nothing else changes.</p>
    </FormDialog>
  );
}

export type TeacherEdit = { id: string; name: string; teacher: boolean; college: string; contract: ContractKind; wantsMore: boolean };

export function TeacherDialog({ siteId, person }: { siteId: string; person: TeacherEdit }) {
  const refresh = useRefresh();
  const fid = `stf-t-${person.id}`;
  return (
    <FormDialog portalClassName={THEME} trigger={<Button variant={person.teacher ? "outline" : "default"}>{person.teacher ? "Change" : "Make a teacher"}</Button>}
      title={person.teacher ? `Change ${person.name}` : `Make ${person.name} a teacher`} description="Their contracted hours, date of birth and qualifications stay on their Staff page."
      submitLabel="Save" successMessage="Teacher saved" onSuccess={refresh}
      submit={(fd) => saveTeacher(siteId, person.id, true, { college: text(fd, "college") as College, contract: text(fd, "contract") as ContractKind, wantsMore: checked(fd, "wantsMore") })}>
      <Field label="College" htmlFor={`${fid}-college`} hint="Their exam seasons and deadlines follow it.">
        <NativeSelect id={`${fid}-college`} name="college" defaultValue={person.college} className="min-h-11 w-full">
          {COLLEGES.map((c) => <NativeSelectOption key={c} value={c}>{COLLEGE_META[c].label}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Contract" htmlFor={`${fid}-contract`} hint="Only a swim teacher and lifeguard contract takes lifeguard shifts.">
        <NativeSelect id={`${fid}-contract`} name="contract" defaultValue={person.contract} className="min-h-11 w-full">
          {CONTRACT_KINDS.map((c) => <NativeSelectOption key={c} value={c}>{CONTRACT_KIND_META[c].label}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Label className="flex min-h-11 items-center gap-3"><Checkbox name="wantsMore" defaultChecked={person.wantsMore} />Wants extra hours</Label>
    </FormDialog>
  );
}

export function RemoveTeacher({ siteId, person }: { siteId: string; person: TeacherEdit }) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} trigger={<Button variant="ghost">Remove</Button>} title={`${person.name} is no longer a teacher?`}
      description="They are no longer offered for places. Shifts they already have stay theirs." submitLabel="Remove" successMessage="Removed" onSuccess={refresh}
      submit={() => saveTeacher(siteId, person.id, false, { college: person.college as College, contract: person.contract })}>
      <p className="text-sm text-ui-muted-foreground">Their strikes and history stay.</p>
    </FormDialog>
  );
}

export type SeasonEdit = { id: string; college: string; name: string; startsOn: string; endsOn: string; firstYearStartsOn: string | null; confirmed: boolean };

export function SeasonDialog({ season }: { season?: SeasonEdit }) {
  const refresh = useRefresh();
  const fid = season ? `stf-s-${season.id}` : "stf-s-new";
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={season ? <Button variant="outline" size="icon" aria-label="Change season"><Pencil aria-hidden="true" /></Button> : <Button><Plus aria-hidden="true" />Add a season</Button>}
      title={season ? "Change the exam season" : "Add an exam season"} description="From the college's published dates. The absence deadline is worked out from the start."
      submitLabel="Save season" successMessage="Season saved" onSuccess={refresh}
      submit={(fd) => saveSeason(season?.id ?? null, { college: text(fd, "college") as "ucc" | "mtu", name: text(fd, "name") as SeasonName, startsOn: text(fd, "startsOn"), endsOn: text(fd, "endsOn"), firstYearStartsOn: text(fd, "firstYearStartsOn"), confirmed: checked(fd, "confirmed") })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="College" htmlFor={`${fid}-college`}>
          <NativeSelect id={`${fid}-college`} name="college" defaultValue={season?.college ?? "ucc"} className="min-h-11 w-full">
            {(["ucc", "mtu"] as const).map((c) => <NativeSelectOption key={c} value={c}>{COLLEGE_META[c].label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Season" htmlFor={`${fid}-name`}>
          <NativeSelect id={`${fid}-name`} name="name" defaultValue={season?.name ?? "winter"} className="min-h-11 w-full">
            {SEASON_NAMES.map((n) => <NativeSelectOption key={n} value={n}>{SEASON_LABEL[n]}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Starts" htmlFor={`${fid}-start`}><Input id={`${fid}-start`} name="startsOn" type="date" required defaultValue={season?.startsOn} className="min-h-11" /></Field>
        <Field label="Ends" htmlFor={`${fid}-end`}><Input id={`${fid}-end`} name="endsOn" type="date" required defaultValue={season?.endsOn} className="min-h-11" /></Field>
      </div>
      <Field label="First years start" htmlFor={`${fid}-first`} optional><Input id={`${fid}-first`} name="firstYearStartsOn" type="date" defaultValue={season?.firstYearStartsOn ?? ""} className="min-h-11" /></Field>
      <Label className="flex min-h-11 items-center gap-3"><Checkbox name="confirmed" defaultChecked={season?.confirmed} />The college has confirmed these dates</Label>
    </FormDialog>
  );
}

export function DeleteSeason({ id }: { id: string }) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} destructive trigger={<Button variant="ghost">Remove</Button>} title="Remove this exam season?" description="Exam absences already recorded keep their outcome."
      submitLabel="Remove" successMessage="Season removed" onSuccess={refresh} submit={() => deleteSeason(id)}>
      <p className="text-sm text-ui-muted-foreground">Nothing else changes.</p>
    </FormDialog>
  );
}

/** Staffing's settings: every number marked (config) in the spec. */
export function SettingsDialog({ settings, types }: { settings: StaffingSettings; types: { id: string; name: string }[] }) {
  const refresh = useRefresh();
  const pick = (name: "teachingTypeId" | "lifeguardTypeId" | "vettingTypeId", label: string) => (
    <Field label={label} htmlFor={`stf-set-${name}`} hint="From Admin's qualification types. Not checked when none is chosen.">
      <NativeSelect id={`stf-set-${name}`} name={name} defaultValue={settings[name] ?? ""} className="min-h-11 w-full">
        <NativeSelectOption value="">Not checked</NativeSelectOption>
        {types.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
      </NativeSelect>
    </Field>
  );
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-2xl" trigger={<Button><Pencil aria-hidden="true" />Change settings</Button>}
      title="Staffing settings" description="For the whole organisation. Every change is logged." submitLabel="Save settings" successMessage="Settings saved" onSuccess={refresh}
      submit={(fd) => saveSettings({
        ...Object.fromEntries(NUMBERS.map(([k]) => [k, text(fd, k)])), ...Object.fromEntries(TIMES.map(([k]) => [k, text(fd, k)])),
        strikeCountingFrom: text(fd, "strikeCountingFrom"),
        teachingTypeId: text(fd, "teachingTypeId") || null, lifeguardTypeId: text(fd, "lifeguardTypeId") || null, vettingTypeId: text(fd, "vettingTypeId") || null,
      })}>
      <div className="grid gap-4 sm:grid-cols-2">
        {TIMES.map(([k, label, hint]) => <Field key={k} label={label} htmlFor={`stf-set-${k}`} hint={hint || undefined}><Input id={`stf-set-${k}`} name={k} type="time" required defaultValue={settings[k]} className="min-h-11" /></Field>)}
        {NUMBERS.map(([k, label, hint]) => <Field key={k} label={label} htmlFor={`stf-set-${k}`} hint={hint || undefined}><Input id={`stf-set-${k}`} name={k} type="number" inputMode="numeric" min={0} required defaultValue={settings[k]} className="min-h-11" /></Field>)}
        <Field label="Strikes count from" htmlFor="stf-set-count" hint="Before this, strikes are logged but not counted."><Input id="stf-set-count" name="strikeCountingFrom" type="date" required defaultValue={settings.strikeCountingFrom} className="min-h-11" /></Field>
      </div>
      {pick("teachingTypeId", "Swim teacher qualification")}
      {pick("lifeguardTypeId", "Lifeguard qualification")}
      {pick("vettingTypeId", "Garda vetting")}
    </FormDialog>
  );
}

