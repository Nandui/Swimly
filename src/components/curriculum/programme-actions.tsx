"use client";

import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/workspace/actions";
import { IconButton } from "@/components/workspace/actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createProgramme,
  moveProgramme,
  setProgrammeArchived,
  updateProgramme,
} from "@/lib/curriculum/actions/programmes";
import { Icon } from "@/components/workspace/misc";

import { ImageField } from "./image-field";
import { curriculumImageUrl } from "@/lib/curriculum/image";

type Programme = { id: string; name: string; description: string | null; archivedAt: Date | null; imageVersion?: string | null };

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
      <ImageField name={programme?.name} currentSrc={programme ? curriculumImageUrl("programme", programme.id, programme.imageVersion) : undefined} />
    </>
  );
}

export function AddProgramme() {
  return (
    <FormDialog
      trigger={
        <Button label="Add programme" variant="primary" size="sm" icon={<Icon icon={Plus} size="sm" />} />
      }
      title="Add a programme"
      description="A programme holds the ordered levels a swimmer works through."
      submitLabel="Add programme"
      successMessage="Programme added"
      submit={(formData) => createProgramme(readInput(formData), formData)}
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
          <IconButton label={`Edit ${programme.name}`} variant="ghost" size="sm" icon={<Icon icon={Pencil} size="sm" />} />
        ) : (
          <Button label="Edit" variant="secondary" size="sm" icon={<Icon icon={Pencil} size="sm" />} />
        )
      }
      title={`Edit ${programme.name}`}
      submitLabel="Save changes"
      successMessage="Programme updated"
      submit={(formData) => updateProgramme(programme.id, readInput(formData), formData)}
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
        <Icon icon={ArchiveRestore} size="sm" />
      </ActionButton>
    );
  }

  return (
    <ConfirmAction
      trigger={
        <IconButton label={`Archive ${programme.name}`} variant="ghost" size="sm" icon={<Icon icon={Archive} size="sm" />} />
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
        <Icon icon={ChevronUp} size="sm" />
      </ActionButton>
      <ActionButton
        ariaLabel={`Move ${programme.name} down`}
        className={last ? "invisible" : undefined}
        run={() => moveProgramme(programme.id, "down")}
      >
        <Icon icon={ChevronDown} size="sm" />
      </ActionButton>
    </>
  );
}
