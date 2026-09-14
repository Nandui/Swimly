"use client";
import { Button } from "@/components/shadcn/button";

import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";

import { Input } from "@/components/ui/input";
import {
  createClub,
  setClubArchived,
  updateClub,
} from "@/lib/clubs/actions/clubs";

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
        <Button variant="default" size="sm">
          {<Plus aria-hidden={true} className="size-4 shrink-0" />}
          {"Add a club"}
        </Button>
      }
      title="Add a club"
      description="A new site starts with an empty timetable. Swimmers, programmes and progress are shared across all sites."
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
        <Button
          variant="ghost"
          aria-label={`Rename ${club.name}`}
          size="icon-sm"
        >
          {<Pencil aria-hidden={true} className="size-4 shrink-0" />}
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
        <ArchiveRestore aria-hidden={true} className="size-4 shrink-0" />
      </ActionButton>
    );
  }
  return (
    <ConfirmAction
      trigger={
        <Button
          variant="ghost"
          aria-label={`Archive ${club.name}`}
          size="icon-sm"
        >
          {<Archive aria-hidden={true} className="size-4 shrink-0" />}
        </Button>
      }
      title={`Archive ${club.name}?`}
      description="It leaves the switcher, and anyone working in it lands on the first club still open. Its timetable and history are retained. Shared swimmers and curriculum remain available at the other sites."
      confirmLabel="Archive"
      successMessage="Club archived"
      run={() => setClubArchived(club.id, true)}
    />
  );
}
