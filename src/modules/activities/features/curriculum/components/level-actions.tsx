"use client";
import { Button } from "@/components/shadcn/button";

import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
} from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createCompetency,
  moveCompetency,
  setCompetencyArchived,
  updateCompetency,
} from "@/modules/activities/features/curriculum/server/actions/competencies";
import {
  createLevel,
  moveLevel,
  setLevelArchived,
  updateLevel,
} from "@/modules/activities/features/curriculum/server/actions/levels";

import { ImageField } from "@/modules/activities/features/curriculum/components/image-field";
import { curriculumImageUrl } from "@/modules/activities/features/curriculum/server/image";

type Named = {
  id: string;
  name: string;
  description: string | null;
  archivedAt: Date | null;
  imageVersion?: string | null;
};

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
        optional
        hint="What a swimmer at this level can do."
      >
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={level?.description ?? ""}
        />
      </Field>
      <ImageField
        name={level?.name}
        currentSrc={
          level
            ? curriculumImageUrl("level", level.id, level.imageVersion)
            : undefined
        }
      />
    </>
  );
}

export function AddLevel({ programmeId }: { programmeId: string }) {
  return (
    <FormDialog
      trigger={
        <Button variant="default">
          {<Plus aria-hidden={true} className="size-4 shrink-0" />}
          {"Add a level"}
        </Button>
      }
      title="Add a level"
      description="Levels are worked through in order. This one goes at the end; move it afterwards."
      submitLabel="Add a level"
      successMessage="Level added"
      submit={(formData) =>
        createLevel(programmeId, readInput(formData), formData)
      }
    >
      <LevelFields />
    </FormDialog>
  );
}

export function EditLevel({ level }: { level: Named }) {
  return (
    <FormDialog
      trigger={
        <Button
          variant="outline"
          aria-label={`Edit ${level.name}`}
        >
          <Pencil aria-hidden={true} className="size-4 shrink-0" />
          <span className="pc-only-wide">Edit</span>
        </Button>
      }
      title={`Edit ${level.name}`}
      submitLabel="Save changes"
      successMessage="Level updated"
      submit={(formData) =>
        updateLevel(level.id, readInput(formData), formData)
      }
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
        size="default"
        successMessage="Level restored"
        run={() => setLevelArchived(level.id, false)}
      >
        <ArchiveRestore aria-hidden={true} className="size-4 shrink-0" />
        <span className="pc-only-wide">Restore</span>
      </ActionButton>
    );
  }

  return (
    <ConfirmAction
      trigger={
        <Button
          variant="outline"
          aria-label={`Archive ${level.name}`}
        >
          <Archive aria-hidden={true} className="size-4 shrink-0" />
          <span className="pc-only-wide">Archive</span>
        </Button>
      }
      title={`Archive ${level.name}?`}
      description="It stops being offered for new classes and enrolments. Swimmers who already completed it keep that completion, and their assessments stay readable. You can restore it later."
      confirmLabel="Archive"
      successMessage="Level archived"
      run={() => setLevelArchived(level.id, true)}
    />
  );
}

export function MoveLevel({
  level,
  first,
  last,
}: {
  level: Named;
  first: boolean;
  last: boolean;
}) {
  if (first && last) return null;
  return (
    <>
      <ActionButton
        ariaLabel={`Move ${level.name} up`}
        disabled={first}
        run={() => moveLevel(level.id, "up")}
      >
        <ChevronUp aria-hidden={true} className="size-4 shrink-0" />
      </ActionButton>
      <ActionButton
        ariaLabel={`Move ${level.name} down`}
        disabled={last}
        run={() => moveLevel(level.id, "down")}
      >
        <ChevronDown aria-hidden={true} className="size-4 shrink-0" />
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
        optional
        hint="How it is assessed, or what counts as a pass."
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

export function AddCompetency({
  levelId,
  levelName,
}: {
  levelId: string;
  levelName: string;
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline">
          {<Plus aria-hidden={true} className="size-4 shrink-0" />}
          {"Add a competency"}
        </Button>
      }
      title={`Add a competency to ${levelName}`}
      description="Every competency here has to be signed off before a swimmer can complete the level."
      submitLabel="Add a competency"
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
        <Button
          variant="outline"
          aria-label={`Edit ${competency.name}`}
        >
          <Pencil aria-hidden={true} className="size-4 shrink-0" />
          <span className="pc-only-wide">Edit</span>
        </Button>
      }
      title="Edit competency"
      submitLabel="Save changes"
      successMessage="Competency updated"
      submit={(formData) =>
        updateCompetency(competency.id, readInput(formData))
      }
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
        size="default"
        successMessage="Competency restored"
        run={() => setCompetencyArchived(competency.id, false)}
      >
        <ArchiveRestore aria-hidden={true} className="size-4 shrink-0" />
        <span className="pc-only-wide">Restore</span>
      </ActionButton>
    );
  }

  return (
    <ConfirmAction
      trigger={
        <Button
          variant="outline"
          aria-label={`Archive ${competency.name}`}
        >
          <Archive aria-hidden={true} className="size-4 shrink-0" />
          <span className="pc-only-wide">Archive</span>
        </Button>
      }
      title="Archive this competency?"
      description={
        <>
          &ldquo;{competency.name}&rdquo; stops counting toward completing the
          level from now on.{" "}
          {assessed > 0
            ? `The ${assessed} ${assessed === 1 ? "assessment" : "assessments"} already recorded against it stay, and so does every level anyone has already completed.`
            : "Nothing has been assessed against it yet."}{" "}
          This is how the curriculum changes without rewriting the past:
          archive it here and add a new one.
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
  if (first && last) return null;
  return (
    <>
      <ActionButton
        ariaLabel={`Move ${competency.name} up`}
        disabled={first}
        run={() => moveCompetency(competency.id, "up")}
      >
        <ChevronUp aria-hidden={true} className="size-4 shrink-0" />
      </ActionButton>
      <ActionButton
        ariaLabel={`Move ${competency.name} down`}
        disabled={last}
        run={() => moveCompetency(competency.id, "down")}
      >
        <ChevronDown aria-hidden={true} className="size-4 shrink-0" />
      </ActionButton>
    </>
  );
}
