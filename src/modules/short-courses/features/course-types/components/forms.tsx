"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { archiveCourseType, saveCourseType } from "@/modules/short-courses/features/course-types/server/actions";
import { MAX_SESSION_MINUTES, MAX_WEEKS, SHORT_COURSE_AREA_META, SHORT_COURSE_AREAS } from "@/modules/short-courses/shared/rules";
import { text, THEME, useRefresh } from "@/modules/short-courses/shared/components/form-kit";

/** The course list's dialogs (docs/short-courses.md). */

export type CourseTypeRow = { id: string; name: string; area: string; description: string; weeks: number; sessionMinutes: number; minAge: number | null; healthForm: boolean; archivedAt: Date | null };

export function CourseTypeDialog({ type, trigger }: { type?: CourseTypeRow; trigger?: ReactNode }) {
  const refresh = useRefresh();
  const fid = type ? `sct-${type.id}` : "sct-new";
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={trigger ?? <Button><Plus aria-hidden="true" />Add a course</Button>}
      title={type ? `Change ${type.name}` : "Add a course we offer"}
      description="A new run starts with these weeks and session length. Runs already on keep their own."
      submitLabel={type ? "Save course" : "Add course"} successMessage={type ? "Course saved" : "Course added"} onSuccess={refresh}
      submit={(fd) => saveCourseType(type?.id ?? null, {
        name: text(fd, "name"), area: text(fd, "area"), description: text(fd, "description"), weeks: Number(fd.get("weeks") || 0),
        sessionMinutes: Number(fd.get("sessionMinutes") || 0), minAge: text(fd, "minAge"), healthForm: fd.get("healthForm") === "on",
      })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${fid}-name`}><Input id={`${fid}-name`} name="name" required minLength={2} maxLength={80} defaultValue={type?.name} placeholder="Couch to 5k" className="min-h-11" /></Field>
        <Field label="Where" htmlFor={`${fid}-area`}>
          <NativeSelect id={`${fid}-area`} name="area" defaultValue={type?.area ?? "pool"} className="min-h-11 w-full">
            {SHORT_COURSE_AREAS.map((a) => <NativeSelectOption key={a} value={a}>{SHORT_COURSE_AREA_META[a].label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Weeks" htmlFor={`${fid}-weeks`} hint="One session a week."><Input id={`${fid}-weeks`} name="weeks" type="number" min={1} max={MAX_WEEKS} required defaultValue={type?.weeks ?? 6} className="min-h-11" /></Field>
        <Field label="Minutes a session" htmlFor={`${fid}-mins`}><Input id={`${fid}-mins`} name="sessionMinutes" type="number" min={15} max={MAX_SESSION_MINUTES} step={5} required defaultValue={type?.sessionMinutes ?? 60} className="min-h-11" /></Field>
        <Field label="Minimum age" htmlFor={`${fid}-age`} optional hint="On the first day."><Input id={`${fid}-age`} name="minAge" type="number" min={1} max={99} defaultValue={type?.minAge ?? ""} className="min-h-11" /></Field>
      </div>
      <Field label="What it is" htmlFor={`${fid}-desc`} optional><Textarea id={`${fid}-desc`} name="description" maxLength={300} defaultValue={type?.description} placeholder="From the sofa to running 5 km in eight weeks, with a coach." /></Field>
      <div className="flex min-h-11 items-start gap-3">
        <Checkbox id={`${fid}-health`} name="healthForm" defaultChecked={type?.healthForm ?? false} className="mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={`${fid}-health`}>Asks for a health form</Label>
          <p className="text-xs text-ui-muted-foreground">Such as a PAR-Q for the gym. The course shows who has not handed one in.</p>
        </div>
      </div>
    </FormDialog>
  );
}

export function ArchiveCourseType({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} title={archived ? `Offer ${name} again?` : `Archive ${name}?`}
      description={archived ? "It can be put on again." : "It is no longer offered for new runs. Runs already on keep it."}
      trigger={<Button type="button" variant="ghost">{archived ? "Restore" : "Archive"}</Button>}
      submitLabel={archived ? "Restore" : "Archive"} successMessage={archived ? "Course restored" : "Course archived"} onSuccess={refresh}
      submit={() => archiveCourseType(id, !archived)}>
      <p className="text-sm text-ui-muted-foreground">Nothing else changes.</p>
    </FormDialog>
  );
}
