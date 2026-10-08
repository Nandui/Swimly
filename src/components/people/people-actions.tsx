"use client";

import * as React from "react";
import { ArchiveRestore, Award, Building2, CirclePause, Pencil, Plus, ShieldCheck, ShieldOff, XCircle } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Label } from "@/components/shadcn/label";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Input as FileInput } from "@/components/shadcn/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  recordQualification, revokeQualification, saveDepartment,
  saveQualificationType, setDepartmentArchived, setQualificationTypeArchived, setSuperadmin, setWorksAt, updateEmployment, updateProfile,
  type EmploymentInput,
} from "@/lib/people/actions";
import { CONTRACT_META, CONTRACT_TYPES, hoursOf } from "@/lib/people/constants";

type Option = { id: string; name: string };
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");
const icon = (Icon: typeof Plus) => <Icon aria-hidden={true} className="size-4 shrink-0" />;

/** How someone is employed: contract, hours a week, their last day and payroll's number. */
export function EditEmployment({ person }: { person: { id: string; name: string; contractType: string | null; contractMinutes: number | null; endedOn: string; payrollNumber: string | null } }) {
  return (
    <FormDialog
      trigger={<Button variant="outline">{icon(Pencil)}Edit employment</Button>}
      title={`${person.name}'s employment`}
      description="Their contract and hours, and payroll's employee number. Only HR sees these."
      submitLabel="Save employment"
      successMessage="Employment updated"
      submit={(formData) => updateEmployment(person.id, {
        contractType: text(formData, "contractType") as EmploymentInput["contractType"], contractHours: text(formData, "contractHours"),
        endedOn: text(formData, "endedOn"), payrollNumber: text(formData, "payrollNumber"),
      })}
    >
      <Field label="Contract" htmlFor="contractType">
        <Select id="contractType" name="contractType" defaultValue={person.contractType ?? ""} options={[{ value: "", label: "Not set" }, ...CONTRACT_TYPES.map((k) => ({ value: k, label: CONTRACT_META[k].label }))]} />
      </Field>
      <Field label="Contracted hours a week" htmlFor="contractHours" optional hint="For example 37.5. Leave empty for casual hours.">
        <Input id="contractHours" name="contractHours" inputMode="decimal" defaultValue={person.contractMinutes != null ? hoursOf(person.contractMinutes) : ""} placeholder="37.5" className="w-32" />
      </Field>
      <Field label="Payroll number" htmlFor="payrollNumber" optional><Input id="payrollNumber" name="payrollNumber" maxLength={40} defaultValue={person.payrollNumber ?? ""} className="w-48" /></Field>
      <Field label="Last day" htmlFor="endedOn" optional hint="When they have left, or are due to."><Input id="endedOn" name="endedOn" type="date" defaultValue={person.endedOn} /></Field>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function EditProfile({ person, sites, departments, people, positions }: {
  person: { id: string; name: string; jobTitle: string | null; positionId: string | null; startedOn: string; dateOfBirth: string; primaryClubId: string | null; managerId: string | null; departments: { departmentId: string; isPrimary: boolean }[] };
  sites: Option[];
  departments: Option[];
  people: { id: string; name: string; jobTitle: string | null }[];
  /** Admin's positions: the open ones, and theirs if it has since been archived. */
  positions: Option[];
}) {
  const [chosen, setChosen] = React.useState<string[]>(person.departments.map((d) => d.departmentId));
  const [primary, setPrimary] = React.useState(person.departments.find((d) => d.isPrimary)?.departmentId ?? chosen[0] ?? "");
  const toggle = (id: string, on: boolean) => setChosen((current) => {
    const next = on ? [...current, id] : current.filter((value) => value !== id);
    if (!next.includes(primary)) setPrimary(next[0] ?? "");
    return next;
  });
  return (
    <FormDialog
      trigger={<Button variant="outline">{icon(Pencil)}Edit profile</Button>}
      title={`${person.name}'s profile`}
      description="Their position, main site, manager and departments. Their manager decides who can see their HR record as their team."
      submitLabel="Save profile"
      successMessage="Profile updated"
      submit={(formData) => updateProfile(person.id, {
        positionId: text(formData, "positionId"), startedOn: text(formData, "startedOn"), dateOfBirth: text(formData, "dateOfBirth"),
        primaryClubId: text(formData, "primaryClubId"), managerId: text(formData, "managerId"),
        departmentIds: chosen, primaryDepartmentId: primary,
      })}
    >
      <Field label="Position" htmlFor="positionId" hint={!person.positionId && person.jobTitle ? `Their job title was "${person.jobTitle}". Positions are kept in Admin, Positions.` : "Kept in Admin, Positions. It does not give access: that is their role."}>
        <Select id="positionId" name="positionId" defaultValue={person.positionId ?? ""} options={[{ value: "", label: "Not set" }, ...positions.map((p) => ({ value: p.id, label: p.name }))]} />
      </Field>
      <Field label="Started on" htmlFor="startedOn">
        <Input id="startedOn" name="startedOn" type="date" defaultValue={person.startedOn} />
      </Field>
      <Field label="Date of birth" htmlFor="dateOfBirth" optional hint="Only for staff under 18: the rota gives them their longer breaks. The rota never shows the date.">
        <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={person.dateOfBirth} max={new Date().toISOString().slice(0, 10)} />
      </Field>
      <Field label="Main site" htmlFor="primaryClubId" hint="Where they are usually based. Staff who manage a site's training or rota cover the people based there.">
        <Select id="primaryClubId" name="primaryClubId" defaultValue={person.primaryClubId ?? ""} options={[{ value: "", label: "Not set" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]} />
      </Field>
      <Field label="Manager" htmlFor="managerId" hint="Their line manager. A role given for “their own team” reaches everyone below them.">
        <Select id="managerId" name="managerId" defaultValue={person.managerId ?? ""} options={[{ value: "", label: "No manager" }, ...people.filter((p) => p.id !== person.id).map((p) => ({ value: p.id, label: p.jobTitle ? `${p.name} · ${p.jobTitle}` : p.name }))]} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold mb-2">Departments</legend>
        {departments.length === 0 ? <p className="text-sm text-ui-muted-foreground">No departments yet. Admin adds them under Departments.</p> : null}
        {departments.map((department) => (
          <Label key={department.id} className="flex items-center gap-3 min-h-11 font-normal">
            <Checkbox checked={chosen.includes(department.id)} onCheckedChange={(value) => toggle(department.id, value === true)} />
            {department.name}
          </Label>
        ))}
      </fieldset>
      {chosen.length > 1 ? (
        <Field label="Main department" htmlFor="primaryDepartmentId">
          <Select id="primaryDepartmentId" value={primary} onValueChange={setPrimary} options={departments.filter((d) => chosen.includes(d.id)).map((d) => ({ value: d.id, label: d.name }))} />
        </Field>
      ) : null}
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Where they work
// ---------------------------------------------------------------------------

/** The sites where their role's Swim school, Training and Rota levels apply.
 *  None ticked means every site. */
export function WorksAt({ userId, name, sites, current }: { userId: string; name: string; sites: Option[]; current: string[] }) {
  const id = React.useId();
  const [chosen, setChosen] = React.useState<string[]>(current);
  return (
    <FormDialog
      trigger={<Button variant="outline">{icon(Building2)}Change sites</Button>}
      title={`Where ${name} works`}
      description="Their Swim school, Training and Rota levels apply at these sites. Leave all unticked for every site."
      submitLabel="Save sites"
      successMessage="Sites saved"
      onOpen={() => setChosen(current)}
      submit={() => setWorksAt(userId, chosen)}
    >
      <fieldset className="min-w-0">
        <legend className="sr-only">Sites</legend>
        {sites.map((site) => (
          <div key={site.id} className="flex items-center gap-3">
            <Checkbox
              id={`${id}-${site.id}`}
              checked={chosen.includes(site.id)}
              onCheckedChange={(checked) => setChosen((previous) => checked === true ? [...previous, site.id] : previous.filter((s) => s !== site.id))}
            />
            <Label htmlFor={`${id}-${site.id}`} className="min-h-11 flex-1 cursor-pointer">{site.name}</Label>
          </div>
        ))}
      </fieldset>
    </FormDialog>
  );
}

export function SuperadminToggle({ userId, name, value }: { userId: string; name: string; value: boolean }) {
  return value ? (
    <ConfirmAction
      trigger={<Button variant="outline">{icon(ShieldOff)}Remove superadmin</Button>}
      title={`Remove ${name} as a superadmin?`}
      description="They keep their roles but lose access to restricted HR records, unless a role gives them that."
      confirmLabel="Remove superadmin"
      successMessage="Superadmin removed"
      run={() => setSuperadmin(userId, false)}
    />
  ) : (
    <ConfirmAction
      trigger={<Button variant="outline">{icon(ShieldCheck)}Make superadmin</Button>}
      title={`Make ${name} a superadmin?`}
      description="A superadmin sees and changes everything in the organisation, including HR records. Every view of restricted records is logged."
      confirmLabel="Make superadmin"
      successMessage="Superadmin granted"
      run={() => setSuperadmin(userId, true)}
    />
  );
}

// ---------------------------------------------------------------------------
// Qualifications
// ---------------------------------------------------------------------------

export function RecordQualification({ userId, name, types }: { userId: string; name: string; types: { id: string; name: string; validityMonths: number | null }[] }) {
  const [typeId, setTypeId] = React.useState(types[0]?.id ?? "");
  const [issued, setIssued] = React.useState("");
  const [expires, setExpires] = React.useState("");
  const suggest = (nextType: string, nextIssued: string) => {
    const months = types.find((t) => t.id === nextType)?.validityMonths;
    if (!months || !nextIssued) return;
    const date = new Date(`${nextIssued}T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + months);
    setExpires(date.toISOString().slice(0, 10));
  };
  return (
    <FormDialog
      trigger={<Button variant="outline">{icon(Award)}Record a qualification</Button>}
      title={`Record a qualification for ${name}`}
      description="Record it once you have seen the certificate. You are recorded as having verified it."
      submitLabel="Record qualification"
      successMessage="Qualification recorded"
      submit={(formData) => {
        const file = formData.get("certificate");
        return recordQualification(userId, { typeId, issuedOn: issued, expiresOn: expires, reference: text(formData, "reference"), note: text(formData, "note") }, file instanceof File && file.size ? file : null);
      }}
    >
      <Field label="Qualification" htmlFor="typeId">
        <Select id="typeId" value={typeId} onValueChange={(value) => { setTypeId(value); suggest(value, issued); }} options={types.map((t) => ({ value: t.id, label: t.name }))} />
      </Field>
      <Field label="Issued on" htmlFor="issuedOn">
        <Input id="issuedOn" type="date" required value={issued} onChange={(value) => { setIssued(value); suggest(typeId, value); }} />
      </Field>
      <Field label="Expires on" htmlFor="expiresOn" hint="Filled in from the usual validity; change it to match the certificate. Leave empty if it does not expire.">
        <Input id="expiresOn" type="date" value={expires} onChange={setExpires} />
      </Field>
      <Field label="Certificate reference" htmlFor="reference">
        <Input id="reference" name="reference" maxLength={80} />
      </Field>
      <Field label="Certificate" htmlFor="certificate" optional hint="A photo or PDF of it, up to 5 MB. Kept with the record.">
        <FileInput id="certificate" name="certificate" type="file" accept="application/pdf,image/png,image/jpeg" />
      </Field>
      <Field label="Note" htmlFor="note">
        <Textarea id="note" name="note" maxLength={500} rows={2} />
      </Field>
    </FormDialog>
  );
}

export function RevokeQualification({ id, label }: { id: string; label: string }) {
  return (
    <FormDialog
      trigger={<Button variant="outline" size="icon" aria-label={`Withdraw ${label}`}>{icon(XCircle)}</Button>}
      title={`Withdraw ${label}?`}
      description="It stays on their record as withdrawn, with your reason."
      submitLabel="Withdraw"
      successMessage="Qualification withdrawn"
      submit={(formData) => revokeQualification(id, text(formData, "reason"))}
    >
      <Field label="Reason" htmlFor="reason">
        <Input id="reason" name="reason" required minLength={3} maxLength={300} autoFocus />
      </Field>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Organisation: departments and qualification types
// ---------------------------------------------------------------------------

export function SaveDepartment({ department, sites }: { department?: { id: string; name: string; clubId: string | null }; sites: Option[] }) {
  return (
    <FormDialog
      trigger={department
        ? <Button variant="outline" size="icon" aria-label={`Edit ${department.name}`}>{icon(Pencil)}</Button>
        : <Button variant="default">{icon(Plus)}Add a department</Button>}
      title={department ? `Edit ${department.name}` : "Add a department"}
      description="A team such as Aquatics, Reception or Maintenance. Tie it to a site if it only works at one."
      submitLabel={department ? "Save department" : "Add a department"}
      successMessage={department ? "Department updated" : "Department added"}
      submit={(formData) => saveDepartment(department?.id ?? null, { name: text(formData, "name"), clubId: text(formData, "clubId") })}
    >
      <Field label="Name" htmlFor="name"><Input id="name" name="name" required maxLength={60} defaultValue={department?.name} autoFocus /></Field>
      <Field label="Site" htmlFor="clubId">
        <Select id="clubId" name="clubId" defaultValue={department?.clubId ?? ""} options={[{ value: "", label: "Every site" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]} />
      </Field>
    </FormDialog>
  );
}

export function ArchiveDepartment({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  if (archived) {
    return (
      <ActionButton ariaLabel={`Restore ${name}`} successMessage="Department restored" run={() => setDepartmentArchived(id, false)}>
        {icon(ArchiveRestore)}
      </ActionButton>
    );
  }
  return (
    <ConfirmAction
      trigger={<Button variant="outline" size="icon" aria-label={`Archive ${name}`}>{icon(CirclePause)}</Button>}
      title={`Archive ${name}?`}
      description="It leaves the department lists and nobody can be added to it. Only an empty department can be archived. You can restore it later."
      confirmLabel="Archive"
      successMessage="Department archived"
      run={() => setDepartmentArchived(id, true)}
    />
  );
}

export function SaveQualificationType({ type }: { type?: { id: string; name: string; validityMonths: number | null } }) {
  return (
    <FormDialog
      trigger={type
        ? <Button variant="outline" size="icon" aria-label={`Edit ${type.name}`}>{icon(Pencil)}</Button>
        : <Button variant="outline">{icon(Plus)}Add a qualification</Button>}
      title={type ? `Edit ${type.name}` : "Add a qualification"}
      description="A certificate staff can hold, such as a lifeguard or first aid qualification."
      submitLabel={type ? "Save qualification" : "Add a qualification"}
      successMessage={type ? "Qualification updated" : "Qualification added"}
      submit={(formData) => saveQualificationType(type?.id ?? null, { name: text(formData, "name"), validityMonths: text(formData, "validityMonths") })}
    >
      <Field label="Name" htmlFor="name"><Input id="name" name="name" required maxLength={80} defaultValue={type?.name} autoFocus /></Field>
      <Field label="Usually valid for (months)" htmlFor="validityMonths" hint="Suggests an expiry date when one is recorded. Leave empty if it does not expire.">
        <Input id="validityMonths" name="validityMonths" type="number" min={1} max={240} defaultValue={type?.validityMonths ?? ""} />
      </Field>
    </FormDialog>
  );
}

export function ArchiveQualificationType({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  if (archived) {
    return (
      <ActionButton ariaLabel={`Restore ${name}`} successMessage="Qualification restored" run={() => setQualificationTypeArchived(id, false)}>
        {icon(ArchiveRestore)}
      </ActionButton>
    );
  }
  return (
    <ConfirmAction
      trigger={<Button variant="outline" size="icon" aria-label={`Archive ${name}`}>{icon(CirclePause)}</Button>}
      title={`Archive ${name}?`}
      description="It can no longer be recorded for anyone. Qualifications already recorded stay on their profiles. You can restore it later."
      confirmLabel="Archive"
      successMessage="Qualification archived"
      run={() => setQualificationTypeArchived(id, true)}
    />
  );
}
