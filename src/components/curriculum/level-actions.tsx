"use client";

import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createCompetency,
  moveCompetency,
  setCompetencyArchived,
  updateCompetency,
} from "@/lib/curriculum/actions/competencies";
import {
  createLevel,
  moveLevel,
  setLevelArchived,
  updateLevel,
} from "@/lib/curriculum/actions/levels";
import { Icon } from "@astryxdesign/core/Icon";

type Named = { id: string; name: string; description: string | null; archivedAt: Date | null };

function readInput(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
}

// --- Levels ----------------------------------------------------------------

function LevelFields({ level }: { level?: Named }) {
  return (
    <>
      <Field label="Name" htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          autoFocus
          defaultValue={level?.name}
          placeholder="Otter"
        />
      </Field>
      <Field
        label="Description"
        htmlFor="description"
        hint="Optional — what a swimmer at this level can do."
      >
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={level?.description ?? ""}
        />
      </Field>
    </>
  );
}

export function AddLevel({ programmeId }: { programmeId: string }) {
  return (
    <FormDialog
      trigger={
        <Button label="Add level" variant="primary" size="sm" icon={<Icon icon={Plus} size="sm" />} />
      }
      title="Add a level"
      description="Levels are worked through in order. This one goes at the end; move it afterwards."
      submitLabel="Add level"
      successMessage="Level added"
      submit={(formData) => createLevel(programmeId, readInput(formData))}
    >
      <LevelFields />
    </FormDialog>
  );
}

export function EditLevel({ level }: { level: Named }) {
  return (
    <FormDialog
      trigger={
        <IconButton label={`Edit ${level.name}`} variant="ghost" size="sm" icon={<Icon icon={Pencil} size="sm" />} />
      }
      title={`Edit ${level.name}`}
      submitLabel="Save changes"
      successMessage="Level updated"
      submit={(formData) => updateLevel(level.id, readInput(formData))}
    >
      <LevelFields level={level} />
    </FormDialog>
  );
}

export function ArchiveLevel({ level }: { level: Named }) {
  if (level.archivedAt) {
    return (
      <ActionButton
        ariaLabel={`Restore ${level.name}`}
        successMessage="Level restored"
        run={() => setLevelArchived(level.id, false)}
      >
        <Icon icon={ArchiveRestore} size="sm" />
      </ActionButton>
    );
  }

  return (
    <ConfirmAction
      trigger={
        <IconButton label={`Archive ${level.name}`} variant="ghost" size="sm" icon={<Icon icon={Archive} size="sm" />} />
      }
      title={`Archive ${level.name}?`}
      description="It stops being offered for new classes and enrolments. Swimmers who already completed it keep that completion, and their assessments stay readable. You can restore it later."
      confirmLabel="Archive"
      successMessage="Level archived"
      run={() => setLevelArchived(level.id, true)}
    />
  );
}

export function MoveLevel({ level, first, last }: { level: Named; first: boolean; last: boolean }) {
  return (
    <>
      <ActionButton
        ariaLabel={`Move ${level.name} up`}
        className={first ? "invisible" : undefined}
        run={() => moveLevel(level.id, "up")}
      >
        <Icon icon={ChevronUp} size="sm" />
      </ActionButton>
      <ActionButton
        ariaLabel={`Move ${level.name} down`}
        className={last ? "invisible" : undefined}
        run={() => moveLevel(level.id, "down")}
      >
        <Icon icon={ChevronDown} size="sm" />
      </ActionButton>
    </>
  );
}

// --- Competencies ----------------------------------------------------------

function CompetencyFields({ competency }: { competency?: Named }) {
  return (
    <>
      <Field label="What the swimmer has to do" htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          autoFocus
          defaultValue={competency?.name}
          placeholder="Float on their back for 5 seconds"
        />
      </Field>
      <Field
        label="Notes for the instructor"
        htmlFor="description"
        hint="Optional — how it is assessed, or what counts as a pass."
      >
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={competency?.description ?? ""}
        />
      </Field>
    </>
  );
}

export function AddCompetency({ levelId, levelName }: { levelId: string; levelName: string }) {
  return (
    <FormDialog
      trigger={
        <Button label="Add competency" variant="secondary" size="sm" icon={<Icon icon={Plus} size="sm" />} />
      }
      title={`Add a competency to ${levelName}`}
      description="Every competency here has to be signed off before a swimmer can complete the level."
      submitLabel="Add competency"
      successMessage="Competency added"
      submit={(formData) => createCompetency(levelId, readInput(formData))}
    >
      <CompetencyFields />
    </FormDialog>
  );
}

export function EditCompetency({ competency }: { competency: Named }) {
  return (
    <FormDialog
      trigger={
        <IconButton label={`Edit ${competency.name}`} variant="ghost" size="sm" icon={<Icon icon={Pencil} size="sm" />} />
      }
      title="Edit competency"
      submitLabel="Save changes"
      successMessage="Competency updated"
      submit={(formData) => updateCompetency(competency.id, readInput(formData))}
    >
      <CompetencyFields competency={competency} />
    </FormDialog>
  );
}

export function ArchiveCompetency({
  competency,
  assessed,
}: {
  competency: Named;
  assessed: number;
}) {
  if (competency.archivedAt) {
    return (
      <ActionButton
        ariaLabel={`Restore ${competency.name}`}
        successMessage="Competency restored"
        run={() => setCompetencyArchived(competency.id, false)}
      >
        <Icon icon={ArchiveRestore} size="sm" />
      </ActionButton>
    );
  }

  return (
    <ConfirmAction
      trigger={
        <IconButton label={`Archive ${competency.name}`} variant="ghost" size="sm" icon={<Icon icon={Archive} size="sm" />} />
      }
      title="Archive this competency?"
      description={
        <>
          &ldquo;{competency.name}&rdquo; stops counting toward completing the level from now on.{" "}
          {assessed > 0
            ? `The ${assessed} ${assessed === 1 ? "assessment" : "assessments"} already recorded against it stay, and so does every level anyone has already completed.`
            : "Nothing has been assessed against it yet."}{" "}
          This is how the curriculum changes without rewriting the past — archive it here and add a
          new one.
        </>
      }
      confirmLabel="Archive"
      successMessage="Competency archived"
      run={() => setCompetencyArchived(competency.id, true)}
    />
  );
}

export function MoveCompetency({
  competency,
  first,
  last,
}: {
  competency: Named;
  first: boolean;
  last: boolean;
}) {
  return (
    <>
      <ActionButton
        ariaLabel={`Move ${competency.name} up`}
        className={first ? "invisible" : undefined}
        run={() => moveCompetency(competency.id, "up")}
      >
        <Icon icon={ChevronUp} size="sm" />
      </ActionButton>
      <ActionButton
        ariaLabel={`Move ${competency.name} down`}
        className={last ? "invisible" : undefined}
        run={() => moveCompetency(competency.id, "down")}
      >
        <Icon icon={ChevronDown} size="sm" />
      </ActionButton>
    </>
  );
}
