"use client";

import * as React from "react";
import { KeyRound, Pencil, Plus, UserCheck, UserMinus } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MIN_PASSWORD_LENGTH, permissionCountLabel } from "@/lib/staff/constants";
import {
  createPerson,
  resetPassword,
  setPersonActive,
  updatePerson,
} from "@/lib/staff/actions/staff";
import { Icon } from "@astryxdesign/core/Icon";

type RoleOption = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
};

type Person = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  staffRole: { id: string; name: string } | null;
};

const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters. Give it to them directly and ask them to change it from Account once they are in.`;

function readPerson(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    staffRoleId: String(formData.get("staffRoleId") ?? ""),
  };
}

/** Controlled rather than defaulted, so the hint describes the role that is
 *  *selected*. Left uncontrolled it describes the one the dialog opened with,
 *  which puts one role's powers under another role's name at exactly the
 *  moment someone is deciding what access to hand out. */
function RoleField({ roles, defaultRoleId }: { roles: RoleOption[]; defaultRoleId?: string }) {
  const [roleId, setRoleId] = React.useState(defaultRoleId ?? roles[0]?.id ?? "");
  const selected = roles.find((role) => role.id === roleId);

  const hint = selected
    ? [selected.description, permissionCountLabel(selected.permissions.length)]
        .filter(Boolean)
        .join(" · ")
    : "Roles are set up under Roles.";

  return (
    <Field label="Role" htmlFor="staffRoleId" hint={hint}>
      <Select
        id="staffRoleId"
        name="staffRoleId"
        value={roleId}
        onValueChange={setRoleId}
        required
        placeholder="Pick a role"
        options={roles.map((role) => ({ value: role.id, label: role.name }))}
      />
    </Field>
  );
}

function PersonFields({ roles, person }: { roles: RoleOption[]; person?: Person }) {
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
      <RoleField roles={roles} defaultRoleId={person?.staffRole?.id} />
    </>
  );
}

export function AddPerson({ roles }: { roles: RoleOption[] }) {
  return (
    <FormDialog
      trigger={
        <Button label="Add person" variant="primary" size="sm" icon={<Icon icon={Plus} size="sm" />} />
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
      <PersonFields roles={roles} />
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

export function EditPerson({ person, roles }: { person: Person; roles: RoleOption[] }) {
  return (
    <FormDialog
      trigger={
        <IconButton label={`Edit ${person.name}`} variant="ghost" size="sm" icon={<Icon icon={Pencil} size="sm" />} />
      }
      title={`Edit ${person.name}`}
      submitLabel="Save changes"
      successMessage="Account updated"
      submit={(formData) => updatePerson(person.id, readPerson(formData))}
    >
      <PersonFields roles={roles} person={person} />
    </FormDialog>
  );
}

export function ResetPersonPassword({ person }: { person: Person }) {
  return (
    <FormDialog
      trigger={
        <IconButton label={`Set a new password for ${person.name}`} variant="ghost" size="sm" icon={<Icon icon={KeyRound} size="sm" />} />
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
        <Icon icon={UserCheck} size="sm" />
      </ActionButton>
    );
  }

  return (
    <ConfirmAction
      trigger={
        <IconButton label={`Deactivate ${person.name}`} variant="ghost" size="sm" icon={<Icon icon={UserMinus} size="sm" />} />
      }
      title={`Deactivate ${person.name}?`}
      description="They stop being able to sign in, from their next page load rather than whenever their session would have expired. Everything they recorded — registers, assessments, the audit trail — stays exactly as it is, and you can reactivate them later. Classes they teach keep their name on them."
      confirmLabel="Deactivate"
      successMessage="Account deactivated"
      run={() => setPersonActive(person.id, false)}
    />
  );
}
