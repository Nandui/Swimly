"use client";

import { Copy } from "lucide-react";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        <Button variant="outline" size="sm">
          <Copy className="size-4" />
          Copy to another club
        </Button>
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
        <Select name="clubId" defaultValue={clubs[0].id}>
          <SelectTrigger id="clubId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {clubs.map((club) => (
              <SelectItem key={club.id} value={club.id}>
                {club.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FormDialog>
  );
}
