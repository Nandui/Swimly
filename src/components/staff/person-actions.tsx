"use client";

import * as React from "react";
import { KeyRound, Pencil, Plus, UserCheck, UserMinus } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Role } from "@/generated/prisma/client";
import {
  MIN_PASSWORD_LENGTH,
  ROLE_BLURB,
  ROLE_META,
  ROLE_ORDER,
} from "@/lib/staff/constants";
import {
  createPerson,
  resetPassword,
  setPersonActive,
  updatePerson,
} from "@/lib/staff/actions/staff";

type Person = { id: string; name: string; email: string; role: Role; isActive: boolean };

const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters. Give it to them directly and ask them to change it from Account once they are in.`;

function readPerson(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "VIEWER") as Role,
  };
}

/** Controlled rather than defaulted, because the hint has to describe the role
 *  that is *selected*. Left uncontrolled it describes the one the dialog
 *  opened with, so picking Viewer on an admin's account leaves "Everything,
 *  including the timetable" sitting under the word Viewer — the field then
 *  contradicts itself at exactly the moment someone is deciding what access to
 *  hand out. */
function RoleField({ defaultRole }: { defaultRole?: Role }) {
  const [role, setRole] = React.useState<Role>(defaultRole ?? "VIEWER");

  return (
    <Field label="Role" htmlFor="role" hint={ROLE_BLURB[role]}>
      <Select
        name="role"
        value={role}
        onValueChange={(next) => setRole(next as Role)}
        required
      >
        <SelectTrigger id="role" className="w-full">
          <SelectValue placeholder="Pick a role" />
        </SelectTrigger>
        <SelectContent>
          {ROLE_ORDER.map((option) => (
            <SelectItem key={option} value={option}>
              {ROLE_META[option].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function PersonFields({ person }: { person?: Person }) {
  return (
    <>
      <Field label="Name" htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          autoFocus
          defaultValue={person?.name}
          placeholder="Aoife Ryan"
        />
      </Field>
      <Field label="Email" htmlFor="email" hint="This is what they sign in with.">
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="off"
          defaultValue={person?.email}
          placeholder="aoife@example.com"
        />
      </Field>
      <RoleField defaultRole={person?.role} />
    </>
  );
}

export function AddPerson() {
  return (
    <FormDialog
      trigger={
        <Button size="sm">
          <Plus className="size-4" />
          Add person
        </Button>
      }
      title="Add a person"
      description="They can sign in as soon as you save this, with the email and password you set here."
      submitLabel="Add person"
      successMessage="Account created"
      submit={(formData) =>
        createPerson({
          ...readPerson(formData),
          password: String(formData.get("password") ?? ""),
        })
      }
    >
      <PersonFields />
      <Field label="Temporary password" htmlFor="password" hint={PASSWORD_HINT}>
        <Input
          id="password"
          name="password"
          type="text"
          required
          autoComplete="off"
          minLength={MIN_PASSWORD_LENGTH}
          placeholder="somethingtheycanread"
        />
      </Field>
    </FormDialog>
  );
}

export function EditPerson({ person }: { person: Person }) {
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${person.name}`}>
          <Pencil className="size-3.5" />
        </Button>
      }
      title={`Edit ${person.name}`}
      submitLabel="Save changes"
      successMessage="Account updated"
      submit={(formData) => updatePerson(person.id, readPerson(formData))}
    >
      <PersonFields person={person} />
    </FormDialog>
  );
}

export function ResetPersonPassword({ person }: { person: Person }) {
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Set a new password for ${person.name}`}>
          <KeyRound className="size-3.5" />
        </Button>
      }
      title={`Set a new password for ${person.name}`}
      description="Their old password stops working immediately. Nobody is emailed — tell them yourself."
      submitLabel="Set password"
      successMessage="Password set"
      submit={(formData) => resetPassword(person.id, String(formData.get("password") ?? ""))}
    >
      <Field label="New password" htmlFor="password" hint={PASSWORD_HINT}>
        <Input
          id="password"
          name="password"
          type="text"
          required
          autoFocus
          autoComplete="off"
          minLength={MIN_PASSWORD_LENGTH}
        />
      </Field>
    </FormDialog>
  );
}

export function SetPersonActive({ person }: { person: Person }) {
  if (!person.isActive) {
    return (
      <ActionButton
        ariaLabel={`Reactivate ${person.name}`}
        successMessage="Account reactivated"
        run={() => setPersonActive(person.id, true)}
      >
        <UserCheck className="size-3.5" />
      </ActionButton>
    );
  }

  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Deactivate ${person.name}`}>
          <UserMinus className="size-3.5" />
        </Button>
      }
      title={`Deactivate ${person.name}?`}
      description="They stop being able to sign in, from their next page load rather than whenever their session would have expired. Everything they recorded — registers, assessments, the audit trail — stays exactly as it is, and you can reactivate them later. Classes they teach keep their name on them."
      confirmLabel="Deactivate"
      successMessage="Account deactivated"
      run={() => setPersonActive(person.id, false)}
    />
  );
}
