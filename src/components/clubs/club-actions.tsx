"use client";

import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClub, setClubArchived, updateClub } from "@/lib/clubs/actions/clubs";

type Club = { id: string; name: string; archivedAt: Date | null };

function readInput(formData: FormData) {
  return { name: String(formData.get("name") ?? "") };
}

function ClubFields({ club }: { club?: Club }) {
  return (
    <Field label="Name" htmlFor="name" hint="The site, as staff say it.">
      <Input
        id="name"
        name="name"
        required
        autoFocus
        defaultValue={club?.name}
        placeholder="LeisureWorld Douglas"
      />
    </Field>
  );
}

export function AddClub() {
  return (
    <FormDialog
      trigger={
        <Button size="sm">
          <Plus className="size-4" />
          Add a club
        </Button>
      }
      title="Add a club"
      description="A new site starts empty: its own programmes, classes and swimmers. Copy a programme across from another club's page if it runs the same one."
      submitLabel="Add club"
      successMessage="Club added"
      submit={(formData) => createClub(readInput(formData))}
    >
      <ClubFields />
    </FormDialog>
  );
}

export function EditClub({ club }: { club: Club }) {
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Rename ${club.name}`}>
          <Pencil className="size-3.5" />
        </Button>
      }
      title={`Rename ${club.name}`}
      submitLabel="Save changes"
      successMessage="Club renamed"
      submit={(formData) => updateClub(club.id, readInput(formData))}
    >
      <ClubFields club={club} />
    </FormDialog>
  );
}

export function ArchiveClub({ club }: { club: Club }) {
  if (club.archivedAt) {
    return (
      <ActionButton
        ariaLabel={`Restore ${club.name}`}
        successMessage="Club restored"
        run={() => setClubArchived(club.id, false)}
      >
        <ArchiveRestore className="size-3.5" />
      </ActionButton>
    );
  }
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Archive ${club.name}`}>
          <Archive className="size-3.5" />
        </Button>
      }
      title={`Archive ${club.name}?`}
      description="It leaves the switcher, and anyone working in it lands on the first club still open. Its programmes, classes, swimmers and history stay exactly as they are, readable again the moment it is restored."
      confirmLabel="Archive"
      successMessage="Club archived"
      run={() => setClubArchived(club.id, true)}
    />
  );
}
