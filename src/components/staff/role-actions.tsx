"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/workspace/actions";
import { CheckboxList, CheckboxListItem } from "@/components/workspace/choices";
import { IconButton } from "@/components/workspace/actions";
import { RadioList, RadioListItem } from "@/components/workspace/choices";
import { VStack } from "@/components/workspace/layout";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createRole, deleteRole, updateRole } from "@/lib/staff/actions/roles";
import {
  PERMISSIONS,
  PERMISSION_GROUP_ORDER,
  ROLE_HOMES,
  ROLE_HOME_ORDER,
} from "@/lib/staff/permissions";
import { SCREENS } from "@/lib/staff/screens";
import { Icon } from "@/components/workspace/misc";

type Role = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  home: string;
  screens: string[];
  isSystem: boolean;
};

function readRole(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    // The pickers hold their choice in state and post it through hidden
    // inputs, one per tick, so `getAll` reads the set like a native form.
    permissions: formData.getAll("permissions").map(String),
    screens: formData.getAll("screens").map(String),
    home: String(formData.get("home") ?? "overview"),
  };
}


function Ticked({ name, values }: { name: string; values: string[] }) {
  return (
    <>
      {values.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

/** Which screens the role offers at all. An instructor role ticks Today and
 *  nothing else, and the deck becomes their whole app. */
function ScreenPicker({ role }: { role?: Role }) {
  const [screens, setScreens] = React.useState<string[]>(role?.screens ?? []);
  return (
    <>
      <Ticked name="screens" values={screens} />
      <CheckboxList
        label="Which screens this role can open"
        description="Everything else is a page that does not exist for them. Account is always there."
        value={screens}
        onChange={setScreens}
        hasDividers
        width="100%"
      >
        {SCREENS.map((screen) => (
          <CheckboxListItem
            key={screen.key}
            value={screen.key}
            label={screen.label}
            description={screen.description}
          />
        ))}
      </CheckboxList>
    </>
  );
}

/** Where this role's day starts. */
function HomePicker({ role }: { role?: Role }) {
  const [home, setHome] = React.useState(role?.home ?? "overview");
  return (
    <RadioList
      label="Where they start after signing in"
      value={home}
      onChange={setHome}
      htmlName="home"
      width="100%"
    >
      {ROLE_HOME_ORDER.map((key) => (
        <RadioListItem
          key={key}
          value={key}
          label={ROLE_HOMES[key].label}
          description={ROLE_HOMES[key].description}
        />
      ))}
    </RadioList>
  );
}

/** The permission list, grouped, with every entry carrying the sentence that
 *  says what it actually lets someone do. The descriptions are the point — a
 *  bare list of keys is a list nobody can grant safely. One set of ticks
 *  across the groups. */
function PermissionPicker({ role }: { role?: Role }) {
  const [held, setHeld] = React.useState<string[]>(role?.permissions ?? []);

  function setGroup(group: string, values: string[]) {
    const keys = new Set<string>(
      PERMISSIONS.filter((permission) => permission.group === group).map((p) => p.key)
    );
    setHeld((previous) => [...previous.filter((key) => !keys.has(key)), ...values]);
  }

  return (
    <VStack gap={4}>
      <Ticked name="permissions" values={held} />
      {PERMISSION_GROUP_ORDER.map((group, index) => {
        const inGroup = PERMISSIONS.filter((permission) => permission.group === group);
        const chosen = held.filter((key) => inGroup.some((permission) => permission.key === key));
        return (
          <CheckboxList
            key={group}
            label={index === 0 ? `What this role may do · ${group}` : group}
            value={chosen}
            onChange={(values) => setGroup(group, values)}
            hasDividers
            width="100%"
          >
            {inGroup.map((permission) => (
              <CheckboxListItem
                key={permission.key}
                value={permission.key}
                label={permission.label}
                description={permission.description}
              />
            ))}
          </CheckboxList>
        );
      })}
    </VStack>
  );
}

function RoleFields({ role }: { role?: Role }) {
  return (
    <>
      <Field label="Name" htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          autoFocus
          defaultValue={role?.name}
          placeholder="Head Coach"
        />
      </Field>
      <Field
        label="Description"
        htmlFor="description"
        hint="Optional — one line, so whoever assigns it knows who it is for."
      >
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={role?.description ?? ""}
        />
      </Field>
      <ScreenPicker role={role} />
      <PermissionPicker role={role} />
      <HomePicker role={role} />
    </>
  );
}

export function AddRole() {
  return (
    <FormDialog
      trigger={
        <Button
          label="Add role"
          variant="primary"
          size="sm"
          icon={<Icon icon={Plus} size="sm" />}
        />
      }
      title="Add a role"
      description="A role is a named set of permissions. Give it the smallest set that lets the job get done."
      submitLabel="Add role"
      successMessage="Role added"
      width="sm:max-w-lg"
      submit={(formData) => createRole(readRole(formData))}
    >
      <RoleFields />
    </FormDialog>
  );
}

export function EditRole({ role }: { role: Role }) {
  return (
    <FormDialog
      trigger={
        <IconButton
          label={`Edit ${role.name}`}
          variant="ghost"
          size="sm"
          icon={<Icon icon={Pencil} size="sm" />}
        />
      }
      title={`Edit ${role.name}`}
      description="Changes take effect on everyone holding this role at their next page load."
      submitLabel="Save changes"
      successMessage="Role updated"
      width="sm:max-w-lg"
      submit={(formData) => updateRole(role.id, readRole(formData))}
    >
      <RoleFields role={role} />
    </FormDialog>
  );
}

export function DeleteRole({ role, users }: { role: Role; users: number }) {
  // A built-in role cannot go, so there is no button to press.
  if (role.isSystem) return null;
  return (
    <ConfirmAction
      trigger={
        <IconButton
          label={`Delete ${role.name}`}
          variant="ghost"
          size="sm"
          icon={<Icon icon={Trash2} size="sm" />}
        />
      }
      title={`Delete ${role.name}?`}
      description={
        users > 0
          ? `${users} ${users === 1 ? "account is" : "accounts are"} on this role. Move ${users === 1 ? "them" : "them"} to another one first — this will be refused otherwise.`
          : "Nobody holds it, so nothing changes for anyone. The audit log records what people did, never which role let them, so nothing already recorded becomes harder to read."
      }
      confirmLabel="Delete"
      successMessage="Role deleted"
      destructive
      run={() => deleteRole(role.id)}
    />
  );
}
