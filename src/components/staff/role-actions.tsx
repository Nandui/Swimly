"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
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
    // Native checkboxes, not a Radix control: `getAll` is the whole reason.
    // A switch would need its own state and a hidden input per permission to
    // reach the form at all.
    permissions: formData.getAll("permissions").map(String),
    screens: formData.getAll("screens").map(String),
    home: String(formData.get("home") ?? "overview"),
  };
}

/** Which screens the role offers at all. An instructor role ticks Today and
 *  nothing else, and the deck becomes their whole app. */
function ScreenPicker({ role }: { role?: Role }) {
  const held = new Set(role?.screens ?? []);
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 block text-[13px] font-medium text-foreground">
        Which screens this role can open
      </legend>
      <p className="text-xs text-muted-foreground">
        Everything else is a page that does not exist for them. Account is always there.
      </p>
      <div className="overflow-hidden rounded-md border">
        {SCREENS.map((screen) => (
          <label
            key={screen.key}
            htmlFor={`screen-${screen.key}`}
            className="flex cursor-pointer items-start gap-2.5 border-b p-2.5 transition-colors last:border-0 hover:bg-accent/40"
          >
            <input
              id={`screen-${screen.key}`}
              type="checkbox"
              name="screens"
              value={screen.key}
              defaultChecked={held.has(screen.key)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-foreground">{screen.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {screen.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Where this role's day starts. Native radios, for the same reason the
 *  permissions are native checkboxes. */
function HomePicker({ role }: { role?: Role }) {
  const current = role?.home ?? "overview";
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 block text-[13px] font-medium text-foreground">
        Where they start after signing in
      </legend>
      <div className="overflow-hidden rounded-md border">
        {ROLE_HOME_ORDER.map((key) => (
          <label
            key={key}
            htmlFor={`home-${key}`}
            className="flex cursor-pointer items-start gap-2.5 border-b p-2.5 transition-colors last:border-0 hover:bg-accent/40"
          >
            <input
              id={`home-${key}`}
              type="radio"
              name="home"
              value={key}
              defaultChecked={current === key}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-foreground">
                {ROLE_HOMES[key].label}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {ROLE_HOMES[key].description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The permission list, grouped, with every entry carrying the sentence that
 *  says what it actually lets someone do. The descriptions are the point — a
 *  bare list of keys is a list nobody can grant safely. */
function PermissionPicker({ role }: { role?: Role }) {
  const held = new Set(role?.permissions ?? []);

  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 block text-[13px] font-medium text-foreground">
        What this role may do
      </legend>

      {PERMISSION_GROUP_ORDER.map((group) => (
        <div key={group} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{group}</p>
          <div className="overflow-hidden rounded-md border">
            {PERMISSIONS.filter((permission) => permission.group === group).map((permission) => (
              <label
                key={permission.key}
                htmlFor={`permission-${permission.key}`}
                className="flex cursor-pointer items-start gap-2.5 border-b p-2.5 transition-colors last:border-0 hover:bg-accent/40"
              >
                <input
                  id={`permission-${permission.key}`}
                  type="checkbox"
                  name="permissions"
                  value={permission.key}
                  defaultChecked={held.has(permission.key)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-foreground">
                    {permission.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {permission.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
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
        <Button size="sm">
          <Plus className="size-4" />
          Add role
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
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${role.name}`}>
          <Pencil className="size-3.5" />
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
  return (
    <ConfirmAction
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${role.name}`}
          className={role.isSystem ? "invisible" : undefined}
        >
          <Trash2 className="size-3.5" />
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
