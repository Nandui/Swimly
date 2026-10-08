"use client";

import { ArchiveRestore, CirclePause, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { savePosition, setPositionArchived } from "@/lib/setup/actions";

type Option = { id: string; name: string };

/** Add a position, or rename one and choose the qualifications it needs. */
export function PositionDialog({ position, qualifications }: { position?: { id: string; name: string; requires: Option[] }; qualifications: Option[] }) {
  const id = position ? `pos-${position.id}` : "pos-new";
  const held = new Set(position?.requires.map((r) => r.id) ?? []);
  return (
    <FormDialog
      width="sm:max-w-lg"
      trigger={position
        ? <Button variant="outline" size="icon" aria-label={`Change ${position.name}`}><Pencil aria-hidden="true" /></Button>
        : <Button><Plus aria-hidden="true" />Add a position</Button>}
      title={position ? `Change ${position.name}` : "Add a position"}
      description="A job people hold, such as Lifeguard or Swim teacher. It does not give access: that is their role."
      submitLabel={position ? "Save position" : "Add position"}
      successMessage={position ? "Position saved" : "Position added"}
      submit={(formData) => savePosition(position?.id ?? null, { name: String(formData.get("name") ?? ""), requires: formData.getAll("requires").map(String) })}
    >
      <Field label="Name" htmlFor={`${id}-name`}><Input id={`${id}-name`} name="name" required minLength={2} maxLength={60} defaultValue={position?.name} autoFocus /></Field>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 text-sm font-semibold">Qualifications it needs</legend>
        {qualifications.length === 0 ? <p className="text-sm text-ui-muted-foreground">Add qualifications under Admin, Qualifications first.</p> : qualifications.map((q) => (
          <div key={q.id} className="flex min-h-11 items-center gap-3">
            <Checkbox id={`${id}-q-${q.id}`} name="requires" value={q.id} defaultChecked={held.has(q.id)} />
            <Label htmlFor={`${id}-q-${q.id}`} className="font-normal">{q.name}</Label>
          </div>
        ))}
      </fieldset>
    </FormDialog>
  );
}

export function ArchivePosition({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  if (archived) return <ActionButton ariaLabel={`Restore ${name}`} successMessage="Position restored" run={() => setPositionArchived(id, false)}><ArchiveRestore aria-hidden="true" /></ActionButton>;
  return (
    <ConfirmAction
      trigger={<Button variant="outline" size="icon" aria-label={`Archive ${name}`}><CirclePause aria-hidden="true" /></Button>}
      title={`Archive ${name}?`}
      description="It is no longer offered for new people. Anyone holding it keeps it until their position is changed. You can restore it later."
      confirmLabel="Archive"
      successMessage="Position archived"
      run={() => setPositionArchived(id, true)}
    />
  );
}
