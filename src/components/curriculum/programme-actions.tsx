"use client";

import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createProgramme,
  moveProgramme,
  setProgrammeArchived,
  updateProgramme,
} from "@/lib/curriculum/actions/programmes";

type Programme = { id: string; name: string; description: string | null; archivedAt: Date | null };

function readInput(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
}

function ProgrammeFields({ programme }: { programme?: Programme }) {
  return (
    <>
      <Field label="Name" htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          autoFocus
          defaultValue={programme?.name}
          placeholder="Learn to Swim"
        />
      </Field>
      <Field label="Description" htmlFor="description" hint="Optional — one line is plenty.">
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={programme?.description ?? ""}
        />
      </Field>
    </>
  );
}

export function AddProgramme() {
  return (
    <FormDialog
      trigger={
        <Button label="Add programme" variant="primary" size="sm" icon={<Plus className="size-4" aria-hidden />} />
      }
      title="Add a programme"
      description="A programme holds the ordered levels a swimmer works through."
      submitLabel="Add programme"
      successMessage="Programme added"
      submit={(formData) => createProgramme(readInput(formData))}
    >
      <ProgrammeFields />
    </FormDialog>
  );
}

export function EditProgramme({
  programme,
  variant = "icon",
}: {
  programme: Programme;
  variant?: "icon" | "button";
}) {
  return (
    <FormDialog
      trigger={
        variant === "icon" ? (
          <IconButton label={`Edit ${programme.name}`} variant="ghost" size="sm" icon={<Pencil className="size-4" aria-hidden />} />
        ) : (
          <Button label="Edit" variant="secondary" size="sm" icon={<Pencil className="size-4" aria-hidden />} />
        )
      }
      title={`Edit ${programme.name}`}
      submitLabel="Save changes"
      successMessage="Programme updated"
      submit={(formData) => updateProgramme(programme.id, readInput(formData))}
    >
      <ProgrammeFields programme={programme} />
    </FormDialog>
  );
}

export function ArchiveProgramme({ programme }: { programme: Programme }) {
  const archived = Boolean(programme.archivedAt);

  if (archived) {
    return (
      <ActionButton
        ariaLabel={`Restore ${programme.name}`}
        successMessage="Programme restored"
        run={() => setProgrammeArchived(programme.id, false)}
      >
        <ArchiveRestore className="size-3.5" />
      </ActionButton>
    );
  }

  return (
    <ConfirmAction
      trigger={
        <IconButton label={`Archive ${programme.name}`} variant="ghost" size="sm" icon={<Archive className="size-4" aria-hidden />} />
      }
      title={`Archive ${programme.name}?`}
      description="It stops appearing when someone picks a programme, and its levels stop being offered. Everything already recorded against it — enrolments, completions, the audit trail — stays exactly as it is, and you can restore it later."
      confirmLabel="Archive"
      successMessage="Programme archived"
      run={() => setProgrammeArchived(programme.id, true)}
    />
  );
}

export function MoveProgramme({
  programme,
  first,
  last,
}: {
  programme: Programme;
  first: boolean;
  last: boolean;
}) {
  return (
    <>
      <ActionButton
        ariaLabel={`Move ${programme.name} up`}
        className={first ? "invisible" : undefined}
        run={() => moveProgramme(programme.id, "up")}
      >
        <ChevronUp className="size-3.5" />
      </ActionButton>
      <ActionButton
        ariaLabel={`Move ${programme.name} down`}
        className={last ? "invisible" : undefined}
        run={() => moveProgramme(programme.id, "down")}
      >
        <ChevronDown className="size-3.5" />
      </ActionButton>
    </>
  );
}
