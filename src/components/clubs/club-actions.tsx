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
        placeholder="Riverside"
      />
    </Field>
  );
}

export function AddClub() {
  return (
    <FormDialog
      trigger={
        <Button variant="default">
          {<Plus aria-hidden={true} className="size-4 shrink-0" />}
          {"Add a site"}
        </Button>
      }
      title="Add a site"
      description="A new site starts with an empty timetable. Swimmers, programmes and progress are shared across all sites."
      submitLabel="Add site"
      successMessage="Site added"
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
          variant="outline"
          aria-label={`Rename ${club.name}`}
          size="icon"
        >
          {<Pencil aria-hidden={true} className="size-4 shrink-0" />}
        </Button>
      }
      title={`Rename ${club.name}`}
      submitLabel="Save changes"
      successMessage="Site renamed"
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
        successMessage="Site restored"
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
          variant="outline"
          aria-label={`Archive ${club.name}`}
          size="icon"
        >
          {<Archive aria-hidden={true} className="size-4 shrink-0" />}
        </Button>
      }
      title={`Archive ${club.name}?`}
      description="It leaves the site picker, and anyone working there moves to the first site still open. Its timetable and history are kept. Shared swimmers and curriculum stay available at the other sites."
      confirmLabel="Archive"
      successMessage="Site archived"
      run={() => setClubArchived(club.id, true)}
    />
  );
}
