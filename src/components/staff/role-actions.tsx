"use client";
import { Button } from "@/components/shadcn/button";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Checkbox } from "@/components/shadcn/checkbox";
import { Label } from "@/components/shadcn/label";

import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";

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
  normaliseRoleHome,
  ADMINISTRATOR_PERMISSIONS,
  hasAdministratorAccess,
} from "@/lib/staff/permissions";
import { SCREENS, cleanScreens } from "@/lib/staff/screens";

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
    home: String(formData.get("home") ?? "calendar"),
  };
}

/** The explicit selected set posts once, including permissions outside known groups. */
function Ticked({ name, values }: { name: string; values: string[] }) {
  return (
    <>
      {values.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

/** Which screens the role offers at all. An instructor role ticks Instructor and
 *  nothing else, and the deck becomes their whole app. */
function ScreenPicker({ role, administrator }: { role?: Role; administrator: boolean }) {
  const id = React.useId();
  const [screens, setScreens] = React.useState<string[]>(() =>
    cleanScreens(role?.screens ?? []),
  );
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-semibold">
        Which screens this role can open
      </legend>
      <p className="text-sm text-ui-muted-foreground">
        {administrator
          ? "Administrators can open every screen, including new screens added later."
          : "Only the selected screens are available. Account is always there."}
      </p>
      <Ticked name="screens" values={screens} />
      <div className="divide-y divide-ui-border">
        {SCREENS.map((screen) => (
          <div key={screen.key} className="flex items-start gap-3 py-2">
            <Checkbox
              id={`${id}-${screen.key}`}
              checked={administrator || screens.includes(screen.key)}
              disabled={administrator}
              onCheckedChange={(checked) =>
                setScreens((previous) =>
                  checked === true
                    ? [...previous, screen.key]
                    : previous.filter((key) => key !== screen.key),
                )
              }
              className="mt-3"
            />
            <Label
              htmlFor={`${id}-${screen.key}`}
              className="min-h-11 min-w-0 flex-1 cursor-pointer flex-col items-start justify-center gap-1"
            >
              <span>{screen.label}</span>
              <span className="text-sm font-normal text-ui-muted-foreground">
                {screen.description}
              </span>
            </Label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

/** Where this role's day starts. */
function HomePicker({ role }: { role?: Role }) {
  const id = React.useId();
  const [home, setHome] = React.useState<string>(() =>
    normaliseRoleHome(role?.home),
  );
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-semibold">
        Where they start after signing in
      </legend>
      <RadioGroup
        name="home"
        value={home}
        onValueChange={setHome}
        aria-label="Where they start after signing in"
        className="gap-0 divide-y divide-ui-border"
      >
        {ROLE_HOME_ORDER.map((key) => (
          <div key={key} className="flex items-start gap-3 py-2">
            <RadioGroupItem id={`${id}-${key}`} value={key} className="mt-3" />
            <Label
              htmlFor={`${id}-${key}`}
              className="min-h-11 min-w-0 flex-1 cursor-pointer flex-col items-start justify-center gap-1"
            >
              <span>{ROLE_HOMES[key].label}</span>
              <span className="text-sm font-normal text-ui-muted-foreground">
                {ROLE_HOMES[key].description}
              </span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

/** The permission list, grouped, with every entry carrying the sentence that
 *  says what it actually lets someone do. The descriptions are the point — a
 *  bare list of keys is a list nobody can grant safely. One set of ticks
 *  across the groups. */
function PermissionPicker({ held, setHeld, administrator }: {
  held: string[];
  setHeld: React.Dispatch<React.SetStateAction<string[]>>;
  administrator: boolean;
}) {
  const id = React.useId();
  return (
    <div className="min-w-0 space-y-4">
      <p className="text-sm text-ui-muted-foreground">
        Manage staff accounts and Manage roles together grant administrator access
        to every current and future screen and permission.
      </p>
      <Ticked name="permissions" values={held} />
      {PERMISSION_GROUP_ORDER.map((group, index) => (
        <fieldset key={group} className="min-w-0 space-y-2">
          <legend className="text-sm font-semibold">
            {index === 0 ? `What this role may do · ${group}` : group}
          </legend>
          <div className="divide-y divide-ui-border">
            {PERMISSIONS.filter((permission) => permission.group === group).map(
              (permission) => (
                <div
                  key={permission.key}
                  className="flex items-start gap-3 py-2"
                >
                  <Checkbox
                    id={`${id}-${permission.key}`}
                    checked={administrator || held.includes(permission.key)}
                    disabled={administrator && !ADMINISTRATOR_PERMISSIONS.includes(permission.key)}
                    onCheckedChange={(checked) =>
                      setHeld((previous) =>
                        checked === true
                          ? [...previous, permission.key]
                          : previous.filter((key) => key !== permission.key),
                      )
                    }
                    className="mt-3"
                  />
                  <Label
                    htmlFor={`${id}-${permission.key}`}
                    className="min-h-11 min-w-0 flex-1 cursor-pointer flex-col items-start justify-center gap-1"
                  >
                    <span>{permission.label}</span>
                    <span className="text-sm font-normal text-ui-muted-foreground">
                      {permission.description}
                    </span>
                  </Label>
                </div>
              ),
            )}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function RoleFields({ role }: { role?: Role }) {
  const [held, setHeld] = React.useState<string[]>(role?.permissions ?? []);
  const administrator = hasAdministratorAccess(held);
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
      <p role="status" className="text-sm font-medium">
        {administrator
          ? "Administrator access · All screens and permissions, now and in future."
          : "Custom access · Choose the screens and permissions for this role."}
      </p>
      <ScreenPicker role={role} administrator={administrator} />
      <PermissionPicker held={held} setHeld={setHeld} administrator={administrator} />
      <HomePicker role={role} />
    </>
  );
}

export function AddRole() {
  return (
    <FormDialog
      trigger={
        <Button variant="default" size="sm">
          {<Plus aria-hidden={true} className="size-4 shrink-0" />}
          {"Add role"}
        </Button>
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
        <Button variant="ghost" aria-label={`Edit ${role.name}`} size="icon-sm">
          {<Pencil aria-hidden={true} className="size-4 shrink-0" />}
        </Button>
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
        <Button
          variant="ghost"
          aria-label={`Delete ${role.name}`}
          size="icon-sm"
        >
          {<Trash2 aria-hidden={true} className="size-4 shrink-0" />}
        </Button>
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
