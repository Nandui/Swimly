"use client";

import { useState, type ReactNode } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Field, FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/shadcn/input";
import type { ActionResult } from "@/lib/action-result";
import { formatDate } from "@/lib/format";
import { readSwimmerChoice, splitName, SwimmerPicker, type SwimmerPrefill } from "@/modules/short-courses/shared/components/swimmer-picker";
import { THEME, useRefresh } from "@/modules/short-courses/shared/components/form-kit";

/** A booking's swimmer record in the person's dialog (owner request, 21 October 2026): member
 *  number, contacts, emergency contact and medical notes, read live from the swim school. They are
 *  changed on the swimmer's profile, linked here for staff who can open it. */

export type SwimmerCardData = {
  id: string; memberNumber: string | null; name: string; dateOfBirth: string | null;
  contactName: string | null; contactEmail: string | null; contactPhone: string | null;
  emergencyName: string | null; emergencyPhone: string | null; emergencyRelationship: string | null;
  hasMedicalNotes: boolean; medicalNotes: string | null;
};

const tel = (value: string) => <a href={`tel:${value.replace(/[^\d+]/g, "")}`} className="font-semibold tabular-nums">{value}</a>;

export function SwimmerCard({ swimmer, canOpen }: { swimmer: SwimmerCardData; canOpen: boolean }) {
  const rows: [string, ReactNode][] = [
    ["Member number", swimmer.memberNumber ?? "None yet"],
    ["Date of birth", swimmer.dateOfBirth ? formatDate(new Date(`${swimmer.dateOfBirth}T00:00:00Z`)) : "Not recorded"],
    ["Contact", swimmer.contactName ?? "Not recorded"],
    ["Phone", swimmer.contactPhone ? tel(swimmer.contactPhone) : "Not recorded"],
    ["Email", swimmer.contactEmail ?? "Not recorded"],
    ["Emergency contact", [swimmer.emergencyName, swimmer.emergencyRelationship].filter(Boolean).join(" · ") || "Not recorded"],
    ["Emergency phone", swimmer.emergencyPhone ? tel(swimmer.emergencyPhone) : "Not recorded"],
    ["Medical notes", swimmer.medicalNotes ?? (swimmer.hasMedicalNotes ? "On file" : "None")],
  ];
  return (
    <section className="flex flex-col gap-2" aria-label="Swimmer record">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Swimmer record: {swimmer.name}</p>
        {canOpen ? <Button asChild variant="ghost"><a href={`/students/${encodeURIComponent(swimmer.id)}?tab=details`}>Open their profile</a></Button> : null}
      </div>
      <dl className="flex flex-col rounded-2xl bg-ui-muted px-4 py-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 py-1">
            <dt className="text-ui-muted-foreground">{label}</dt>
            <dd className={label === "Medical notes" && swimmer.medicalNotes ? "whitespace-pre-wrap text-right font-semibold text-ui-destructive wrap-anywhere" : "text-right wrap-anywhere"}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="pc-row-hint">Change these on their swimmer record; every course they are on follows.</p>
    </section>
  );
}

/** Link a booking made before the swimmer records (or held online) to the person's record. */
export function SwimmerLinkDialog({ name, prefill, needsDateOfBirth, submit, primary }: {
  name: string; prefill?: SwimmerPrefill; needsDateOfBirth?: boolean; primary?: boolean;
  submit: (choice: ReturnType<typeof readSwimmerChoice>) => Promise<ActionResult>;
}) {
  const refresh = useRefresh();
  const [key, setKey] = useState(0);
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg" key={key}
      trigger={<Button type="button" variant={primary ? "default" : "outline"} aria-label={`Link ${name} to a swimmer record`}><Link2 aria-hidden="true" />Link to swimmer</Button>}
      title={`Link ${name} to their swimmer record`} description="Pick them on the swimmer records, or add them there. Their member number, contacts and medical notes then show on the course."
      submitLabel="Link" successMessage="Linked to their swimmer record" onSuccess={() => { setKey((k) => k + 1); refresh(); }}
      submit={(fd) => submit(readSwimmerChoice(fd))}>
      <SwimmerPicker fid={`link-${name.replace(/\W+/g, "-")}`} initialQuery={name} prefill={{ ...splitName(name), ...prefill }} needsDateOfBirth={needsDateOfBirth} />
    </FormDialog>
  );
}

/** Asked only when the course has a minimum age and the picked swimmer's record has no date of birth. */
export function BirthDateField({ fid, defaultValue, minAge }: { fid: string; defaultValue?: string | null; minAge: number }) {
  return (
    <Field label="Date of birth" htmlFor={`${fid}-dob`} hint={`Their swimmer record has none, and the course is for ${minAge} and over.`}>
      <Input id={`${fid}-dob`} name="dateOfBirth" type="date" required defaultValue={defaultValue ?? ""} className="min-h-11" />
    </Field>
  );
}
