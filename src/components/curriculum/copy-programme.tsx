"use client";

import { Copy } from "lucide-react";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@astryxdesign/core/Button";
import { Select } from "@/components/ui/select";
import { copyProgramme } from "@/lib/curriculum/actions/copy";

type Club = { id: string; name: string };

/** Offered only when there is somewhere to copy to. */
export function CopyProgramme({
  programme,
  clubs,
  levels,
  competencies,
}: {
  programme: { id: string; name: string };
  clubs: Club[];
  levels: number;
  competencies: number;
}) {
  if (clubs.length === 0) return null;

  return (
    <FormDialog
      trigger={
        <Button label="Copy to another club" variant="secondary" size="sm" icon={<Copy className="size-4" aria-hidden />} />
      }
      title={`Copy ${programme.name} to another club`}
      description={`Its ${levels} ${levels === 1 ? "level" : "levels"} and ${competencies} ${
        competencies === 1 ? "competency" : "competencies"
      } go with it, and so do its kinds of assessment. Swimmers, classes and results do not — the other club enrols its own.`}
      submitLabel="Copy programme"
      successMessage="Programme copied"
      submit={(formData) => copyProgramme(programme.id, String(formData.get("clubId") ?? ""))}
    >
      <Field
        label="Copy to"
        htmlFor="clubId"
        hint="It has to be a club without a programme of this name already."
      >
        <Select
          id="clubId"
          name="clubId"
          defaultValue={clubs[0].id}
          options={clubs.map((club) => ({ value: club.id, label: club.name }))}
        />
      </Field>
    </FormDialog>
  );
}
