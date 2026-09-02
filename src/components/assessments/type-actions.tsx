"use client";

import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createAssessmentType,
  setAssessmentTypeArchived,
  updateAssessmentType,
} from "@/lib/assessments/actions/types";

type Named = { id: string; name: string; description: string | null; archivedAt: Date | null };

function readInput(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
}

function TypeFields({ type }: { type?: Named }) {
  return (
    <>
      <Field label="Name" htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          autoFocus
          defaultValue={type?.name}
          placeholder="New swimmers"
        />
      </Field>
      <Field
        label="Description"
        htmlFor="description"
        hint="Optional — who this kind of session is for. The desk sees it when booking."
      >
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={type?.description ?? ""}
          placeholder="Totally new to the water — never had a lesson."
        />
      </Field>
    </>
  );
}

export function AddAssessmentType({
  programmeId,
  programmeName,
}: {
  programmeId: string;
  programmeName: string;
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Add a kind of assessment
        </Button>
      }
      title={`Add a kind of assessment to ${programmeName}`}
      description="New swimmers, mixed abilities, returning after a break — whatever the desk needs to tell apart when booking."
      submitLabel="Add"
      successMessage="Assessment type added"
      submit={(formData) => createAssessmentType(programmeId, readInput(formData))}
    >
      <TypeFields />
    </FormDialog>
  );
}

export function EditAssessmentType({ type }: { type: Named }) {
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${type.name}`}>
          <Pencil className="size-3.5" />
        </Button>
      }
      title={`Edit ${type.name}`}
      submitLabel="Save changes"
      successMessage="Assessment type updated"
      submit={(formData) => updateAssessmentType(type.id, readInput(formData))}
    >
      <TypeFields type={type} />
    </FormDialog>
  );
}

export function ArchiveAssessmentType({ type, sessions }: { type: Named; sessions: number }) {
  if (type.archivedAt) {
    return (
      <ActionButton
        ariaLabel={`Restore ${type.name}`}
        successMessage="Assessment type restored"
        run={() => setAssessmentTypeArchived(type.id, false)}
      >
        <ArchiveRestore className="size-3.5" />
      </ActionButton>
    );
  }
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Archive ${type.name}`}>
          <Archive className="size-3.5" />
        </Button>
      }
      title={`Archive ${type.name}?`}
      description={
        sessions > 0
          ? `It stops being offered for new sessions. The ${sessions} ${sessions === 1 ? "session" : "sessions"} already of this kind keep saying so.`
          : "It stops being offered for new sessions. Restore it any time."
      }
      confirmLabel="Archive"
      successMessage="Assessment type archived"
      run={() => setAssessmentTypeArchived(type.id, true)}
    />
  );
}
