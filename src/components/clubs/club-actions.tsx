"use client";
import { Button } from "@/components/shadcn/button";

import { ArchiveRestore, CirclePause, Pencil, Plus } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";

import { Input } from "@/components/ui/input";
import {
  createClub,
  setClubArchived,
  updateClub,
} from "@/lib/clubs/actions/clubs";

type Club = { id: string; name: string; code?: string | null; archivedAt: Date | null };

function readInput(formData: FormData) {
  return { name: String(formData.get("name") ?? ""), code: String(formData.get("code") ?? "") };
}

function ClubFields({ club }: { club?: Club }) {
  return (
    <>
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
      <Field label="Short code" htmlFor="code" hint="Two to four letters, for example BT. Purchase order numbers use it: PO-BT-00001.">
        <Input id="code" name="code" maxLength={4} defaultValue={club?.code ?? ""} placeholder="DO" className="w-28 uppercase" />
      </Field>
    </>
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
      submitLabel="Add a site"
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
          aria-label={`Change ${club.name}`}
          size="icon"
        >
          {<Pencil aria-hidden={true} className="size-4 shrink-0" />}
        </Button>
      }
      title={`Change ${club.name}`}
      submitLabel="Save changes"
      successMessage="Site saved"
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
          {<CirclePause aria-hidden={true} className="size-4 shrink-0" />}
        </Button>
      }
      title={`Archive ${club.name}?`}
      description="It leaves the site picker, and anyone working there lands on the first site still open. Its timetable and history are kept, and you can restore it later. Shared swimmers and curriculum stay available at the other sites."
      confirmLabel="Archive"
      successMessage="Site archived"
      run={() => setClubArchived(club.id, true)}
    />
  );
}
