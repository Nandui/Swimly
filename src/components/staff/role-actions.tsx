"use client";
import { Button } from "@/components/shadcn/button";

import * as React from "react";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";

import { ChoiceRow } from "@/components/ui/choice-row";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";

import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/ui-kit/notice";
import { createRole, deleteRole, updateRole } from "@/lib/staff/actions/roles";
import { WORK_ANYWHERE, cleanLevels, effectiveLevels, levelsFromAccess, type RoleLevels } from "@/lib/staff/levels";
import { allModules, groupModules, type ModuleManifest } from "@/modules/registry";
import { cn } from "@/lib/utils";

type Role = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  screens: string[];
  levels: unknown;
  extras: string[];
  homeName: string | null;
  isSystem: boolean;
};

const NONE = "none";

function readRole(formData: FormData) {
  const levels: Record<string, string> = {};
  for (const mod of allModules()) {
    const level = String(formData.get(`level:${mod.id}`) ?? NONE);
    if (level !== NONE) levels[mod.id] = level;
  }
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    homeName: String(formData.get("homeName") ?? ""),
    levels,
    extras: formData.getAll("extras").map(String),
  };
}

/** The role's levels as the editor starts: its own, or for a role still on
 *  screens and permissions, the levels the converter would give it. */
function startingLevels(role?: Role): { start: RoleLevels; gains: string[] } {
  if (!role) return { start: { levels: {}, extras: [] }, gains: [] };
  if (role.levels !== null && role.levels !== undefined) return { start: cleanLevels(role.levels, role.extras), gains: [] };
  const proposed = levelsFromAccess(role.permissions, role.screens);
  return { start: proposed.role, gains: proposed.gains };
}

/** One module's ladder, as a row of buttons: None, then its levels. */
function LevelRow({ mod, level, posted, locked, onChange }: {
  mod: ModuleManifest;
  /** What the row shows: Admin Manage shows Manage everywhere. */
  level: string;
  /** What the role itself stores for this module. */
  posted: string;
  /** Set by Admin Manage (every module) or, for HR, by not being a superadmin. */
  locked: string | null;
  onChange: (level: string) => void;
}) {
  const id = React.useId();
  const options = [{ key: NONE, label: "None" }, ...mod.access.levels.map((l) => ({ key: l.key, label: l.label }))];
  const help = level === NONE ? "No access." : mod.access.levels.find((l) => l.key === level)?.help;
  const Icon = mod.icon;
  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span id={`${id}-name`} className={cn("flex items-center gap-2 font-semibold", level === NONE && "text-ui-muted-foreground")}>
          <Icon aria-hidden="true" className={cn("size-5 shrink-0", level === NONE ? "text-ui-muted-foreground" : "text-ui-primary")} />
          {mod.name}
        </span>
        <SegmentedChoice
          value={level}
          onValueChange={onChange}
          disabled={locked !== null}
          aria-labelledby={`${id}-name`}
          options={options.map((option) => ({ value: option.key, label: option.label }))}
        />
      </div>
      <p className="text-sm text-ui-muted-foreground">{locked ?? help}</p>
      <input type="hidden" name={`level:${mod.id}`} value={posted} />
    </div>
  );
}

function Tick({ id, name, value, checked, onChange, label, hint }: {
  id: string; name: string; value: string; checked: boolean; onChange: (checked: boolean) => void; label: string; hint?: string;
}) {
  return (
    <div>
      <ChoiceRow type="checkbox" id={id} title={label} hint={hint} checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      {checked ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}

function RoleFields({ role, canGiveRestricted }: { role?: Role; canGiveRestricted: boolean }) {
  const id = React.useId();
  const { start, gains } = React.useMemo(() => startingLevels(role), [role]);
  const [levels, setLevels] = React.useState<Record<string, string>>({ ...start.levels });
  const [extras, setExtras] = React.useState<string[]>([...start.extras]);
  const admin = levels.admin === "manage";
  const shown = effectiveLevels({ levels, extras });

  const setLevel = (mod: ModuleManifest, level: string) => {
    setLevels((previous) => {
      const next = { ...previous };
      if (level === NONE) delete next[mod.id];
      else next[mod.id] = level;
      return next;
    });
  };
  const toggle = (key: string, on: boolean) => setExtras((previous) => on ? [...new Set([...previous, key])] : previous.filter((k) => k !== key));

  return (
    <>
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required autoFocus defaultValue={role?.name} placeholder="Receptionist" />
      </Field>
      <Field label="Home page name" htmlFor="homeName" hint="What people on this role see first when they sign in, for example Front of House.">
        <Input id="homeName" name="homeName" defaultValue={role?.homeName ?? ""} placeholder="Front of House" maxLength={40} />
      </Field>
      <Field label="Description" htmlFor="description" optional hint="One line, so whoever gives it out knows who it is for.">
        <Textarea id="description" name="description" rows={2} defaultValue={role?.description ?? ""} />
      </Field>

      {role && (role.levels === null || role.levels === undefined) ? (
        <Notice tone={gains.length ? "warning" : "info"} title="This role uses older permission settings">
          {gains.length
            ? "Saving switches it to the levels below, which give a little more than it has now. Check them before you save."
            : "Saving switches it to the levels below, which give exactly what it has now."}
        </Notice>
      ) : null}

      <fieldset className="min-w-0">
        <legend className="text-sm font-semibold">What this role can do in each module</legend>
        <p className="mt-1 text-sm text-ui-muted-foreground">Each level includes the ones before it.</p>
        {groupModules(allModules()).map((group) => (
          <section key={group.key} aria-labelledby={`${id}-${group.key}`} className="mt-3">
            <h3 id={`${id}-${group.key}`} className="text-xs font-semibold text-ui-muted-foreground">{group.label}</h3>
            <div className="divide-y divide-ui-border">
              {group.modules.map((mod) => {
                const locked = admin && mod.id !== "admin" && !mod.access.restricted
                  ? "Admins can use every module except HR."
                  : mod.access.restricted && !canGiveRestricted
                    ? "Only a superadmin can give HR."
                    : null;
                const level = shown.levels[mod.id] ?? NONE;
                return (
                  <div key={mod.id}>
                    <LevelRow mod={mod} level={level} posted={levels[mod.id] ?? NONE} locked={locked} onChange={(value) => setLevel(mod, value)} />
                    {(mod.access.extras ?? []).map((extra) => {
                      const key = `${mod.id}.${extra.key}`;
                      const available = level !== NONE && mod.access.levels.findIndex((l) => l.key === level) >= mod.access.levels.findIndex((l) => l.key === extra.from);
                      if (!available || locked) return null;
                      return <div key={key} className="pb-3"><Tick id={`${id}-${key}`} name="extras" value={key} checked={extras.includes(key)} onChange={(on) => toggle(key, on)} label={extra.label} hint={extra.help} /></div>;
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </fieldset>

      {admin ? null : (
        <Tick
          id={`${id}-anywhere`}
          name="extras"
          value={WORK_ANYWHERE}
          checked={extras.includes(WORK_ANYWHERE)}
          onChange={(on) => toggle(WORK_ANYWHERE, on)}
          label="Can work away from the centre's computers"
          hint="For example on a phone. Everyone else signs in only on the centre's registered computers, once that rule is on."
        />
      )}
      {levels.hr && !canGiveRestricted ? (
        <p className="flex items-center gap-2 text-sm text-ui-muted-foreground"><Lock aria-hidden="true" className="size-4" />This role holds HR, so only a superadmin can change it.</p>
      ) : null}
    </>
  );
}

export function AddRole({ canGiveRestricted = false }: { canGiveRestricted?: boolean }) {
  return (
    <FormDialog
      trigger={
        <Button variant="default">
          <Plus aria-hidden={true} className="size-4 shrink-0" />
          Add a role
        </Button>
      }
      title="Add a role"
      description="A role is a job. Give it the lowest level in each module that lets the job get done."
      submitLabel="Add a role"
      successMessage="Role added"
      width="sm:max-w-2xl"
      submit={(formData) => createRole(readRole(formData))}
    >
      <RoleFields canGiveRestricted={canGiveRestricted} />
    </FormDialog>
  );
}

export function EditRole({ role, canGiveRestricted = false }: { role: Role; canGiveRestricted?: boolean }) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" aria-label={`Edit ${role.name}`} size="icon">
          <Pencil aria-hidden={true} className="size-4 shrink-0" />
        </Button>
      }
      title={`Edit ${role.name}`}
      description="Changes take effect for everyone on this role at their next page load."
      submitLabel="Save changes"
      successMessage="Role updated"
      width="sm:max-w-2xl"
      submit={(formData) => updateRole(role.id, readRole(formData))}
    >
      <RoleFields role={role} canGiveRestricted={canGiveRestricted} />
    </FormDialog>
  );
}

export function DeleteRole({ role, users }: { role: Role; users: number }) {
  // A built-in role cannot go, so there is no button to press.
  if (role.isSystem) return null;
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline" aria-label={`Delete ${role.name}`} size="icon">
          <Trash2 aria-hidden={true} className="size-4 shrink-0" />
        </Button>
      }
      title={`Delete ${role.name}?`}
      description={
        users > 0
          ? `${users} ${users === 1 ? "account is" : "accounts are"} on this role. Move them to another one first, or this will be refused.`
          : "Nobody holds it, so nothing changes for anyone. The activity log records what people did, never which role let them."
      }
      confirmLabel="Delete"
      successMessage="Role deleted"
      destructive
      run={() => deleteRole(role.id)}
    />
  );
}
