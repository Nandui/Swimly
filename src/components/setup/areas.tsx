"use client";

import { ArchiveRestore, ArrowDown, ArrowUp, CirclePause, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { moveArea, saveArea, setAreaArchived } from "@/lib/setup/actions";

/** Add an area to a site, or rename one. A rename reaches every record that uses it. */
export function SaveArea({ siteId, siteName, area }: { siteId: string; siteName: string; area?: { id: string; name: string } }) {
  const id = area ? `area-${area.id}` : `area-new-${siteId}`;
  return (
    <FormDialog
      trigger={area
        ? <Button variant="outline" size="icon" aria-label={`Rename ${area.name}`}><Pencil aria-hidden="true" /></Button>
        : <Button variant="outline"><Plus aria-hidden="true" />Add an area</Button>}
      title={area ? `Rename ${area.name}` : `Add an area at ${siteName}`}
      description={area
        ? "The rota's activities and bookings and the swim school's classes that use it are renamed with it."
        : "A place at the site where work happens, such as 25m pool, Learner pool, Gym or Reception."}
      submitLabel={area ? "Rename" : "Add area"}
      successMessage={area ? "Area renamed" : "Area added"}
      submit={(formData) => saveArea(siteId, area?.id ?? null, { name: String(formData.get("name") ?? "") })}
    >
      <Field label="Name" htmlFor={id}><Input id={id} name="name" required maxLength={60} defaultValue={area?.name} autoFocus /></Field>
    </FormDialog>
  );
}

export function ArchiveArea({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  if (archived) {
    return <ActionButton ariaLabel={`Restore ${name}`} successMessage="Area restored" run={() => setAreaArchived(id, false)}><ArchiveRestore aria-hidden="true" /></ActionButton>;
  }
  return (
    <ConfirmAction
      trigger={<Button variant="outline" size="icon" aria-label={`Archive ${name}`}><CirclePause aria-hidden="true" /></Button>}
      title={`Archive ${name}?`}
      description="It is no longer offered when planning or adding classes. Anything already using it keeps the name. You can restore it later."
      confirmLabel="Archive"
      successMessage="Area archived"
      run={() => setAreaArchived(id, true)}
    />
  );
}

/** Up and down: the order every module offers a site's areas in. */
export function MoveArea({ id, name, first, last }: { id: string; name: string; first: boolean; last: boolean }) {
  return (
    <>
      <ActionButton ariaLabel={`Move ${name} up`} successMessage="Moved" disabled={first} run={() => moveArea(id, "up")}><ArrowUp aria-hidden="true" /></ActionButton>
      <ActionButton ariaLabel={`Move ${name} down`} successMessage="Moved" disabled={last} run={() => moveArea(id, "down")}><ArrowDown aria-hidden="true" /></ActionButton>
    </>
  );
}
