"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field, FormDialog } from "@/components/form-dialog";
import { archiveCourseType, saveCourseType } from "@/modules/academy/features/course-types/server/actions";
import { ACADEMY_CHECKS, ACADEMY_CHECK_KEYS, ACADEMY_KIND_META, ACADEMY_KINDS } from "@/modules/academy/shared/rules";

import { text, THEME, useRefresh, type Option } from "@/modules/academy/shared/components/form-kit";

/** The course list's dialogs (docs/academy.md). */

/* ---------- The course list ---------- */

export type CourseTypeRow = { id: string; name: string; kind: string; awardingBody: string; minAge: number | null; minHours: number; checks: string[]; qualificationTypeId: string | null; archivedAt: Date | null };

export function CourseTypeDialog({ type, qualifications, trigger }: { type?: CourseTypeRow; qualifications: Option[]; trigger?: ReactNode }) {
  const fid = type ? `ct-${type.id}` : "ct-new";
  const checks = new Set(type?.checks ?? ["age"]);
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={trigger ?? <Button><Plus aria-hidden="true" />Add a course</Button>}
      title={type ? `Change ${type.name}` : "Add a course we deliver"}
      description="What it is, who awards it, and what a candidate needs before assessment."
      submitLabel={type ? "Save course" : "Add course"} successMessage={type ? "Course saved" : "Course added"}
      submit={(fd) => saveCourseType(type?.id ?? null, {
        name: text(fd, "name"), kind: text(fd, "kind"), awardingBody: text(fd, "awardingBody"), minAge: text(fd, "minAge"), minHours: Number(fd.get("minHours") || 0),
        checks: fd.getAll("checks").map(String), qualificationTypeId: text(fd, "qualificationTypeId"),
      })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${fid}-name`}><Input id={`${fid}-name`} name="name" required minLength={2} maxLength={80} defaultValue={type?.name} placeholder="National Pool Lifeguard Qualification" className="min-h-11" /></Field>
        <Field label="Kind" htmlFor={`${fid}-kind`}>
          <NativeSelect id={`${fid}-kind`} name="kind" defaultValue={type?.kind ?? "lifeguard"} className="min-h-11 w-full">
            {ACADEMY_KINDS.map((k) => <NativeSelectOption key={k} value={k}>{ACADEMY_KIND_META[k].label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Awarding body" htmlFor={`${fid}-body`} optional><Input id={`${fid}-body`} name="awardingBody" maxLength={80} defaultValue={type?.awardingBody} className="min-h-11" /></Field>
        <Field label="Qualification it gives staff" htmlFor={`${fid}-q`} optional hint="Put on a staff member's record when they pass.">
          <NativeSelect id={`${fid}-q`} name="qualificationTypeId" defaultValue={type?.qualificationTypeId ?? ""} className="min-h-11 w-full">
            <NativeSelectOption value="">None</NativeSelectOption>
            {qualifications.map((q) => <NativeSelectOption key={q.id} value={q.id}>{q.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Minimum age" htmlFor={`${fid}-age`} optional hint="On the course's first day."><Input id={`${fid}-age`} name="minAge" type="number" min={8} max={99} defaultValue={type?.minAge ?? ""} className="min-h-11" /></Field>
        <Field label="Hours to attend" htmlFor={`${fid}-hours`} hint="Before they are put forward for assessment."><Input id={`${fid}-hours`} name="minHours" type="number" min={0} max={500} defaultValue={type?.minHours ?? 0} className="min-h-11" /></Field>
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 text-sm font-semibold">Pre-course checks</legend>
        {ACADEMY_CHECK_KEYS.map((k) => (
          <div key={k} className="flex min-h-11 items-center gap-3">
            <Checkbox id={`${fid}-c-${k}`} name="checks" value={k} defaultChecked={checks.has(k)} />
            <Label htmlFor={`${fid}-c-${k}`} className="font-normal">{ACADEMY_CHECKS[k]}</Label>
          </div>
        ))}
      </fieldset>
    </FormDialog>
  );
}

export function ArchiveCourseType({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} title={archived ? `Offer ${name} again?` : `Archive ${name}?`}
      description={archived ? "It can be put on again." : "It is no longer offered for new courses. Courses already on keep it."}
      trigger={<Button type="button" variant="ghost">{archived ? "Restore" : "Archive"}</Button>}
      submitLabel={archived ? "Restore" : "Archive"} successMessage={archived ? "Course restored" : "Course archived"} onSuccess={refresh}
      submit={() => archiveCourseType(id, !archived)}>
      <p className="text-sm text-ui-muted-foreground">Nothing else changes.</p>
    </FormDialog>
  );
}
