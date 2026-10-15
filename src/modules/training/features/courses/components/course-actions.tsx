"use client";

import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Switch } from "@/components/ui/switch";
import { saveCourse, setCourseArchived } from "@/modules/training/features/courses/server/actions";
import { THEME } from "@/modules/training/shared/components/dialog-kit";

type QualificationOption = { id: string; name: string; validityMonths: number | null };
type CourseDraft = { id: string; title: string; summary: string; requiresSignoff: boolean; grantsType: { id: string } | null };

/** A course's settings. A new course opens in the builder to add its lessons. */
export function CourseDialog({ course, qualificationTypes }: { course?: CourseDraft; qualificationTypes: QualificationOption[] }) {
  const router = useRouter();
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-2xl"
      trigger={course
        ? <Button variant="outline" className="min-h-11" aria-label={`Settings for ${course.title}`}><Settings2 aria-hidden="true" /><span className="pc-only-wide">Settings</span></Button>
        : <Button className="min-h-11"><Plus aria-hidden="true" />Add a course</Button>}
      title={course ? `Settings for ${course.title}` : "Add a course"}
      description={course ? "Changes here apply straight away, to every version." : "Name it, then add its lessons in the builder. People take it in Turnfin Me."}
      submitLabel={course ? "Save settings" : "Add and build"}
      successMessage={course ? "Settings saved" : "Course added"}
      submit={async (formData) => {
        const result = await saveCourse(course?.id ?? null, {
          title: String(formData.get("title") ?? ""),
          summary: String(formData.get("summary") ?? ""),
          requiresSignoff: formData.get("requiresSignoff") === "on",
          grantsTypeId: String(formData.get("grantsTypeId") ?? ""),
        });
        if (!result.ok) return result;
        if (!course) router.push(`/training/courses/${result.id}`); else router.refresh();
        return { ok: true };
      }}
    >
      <Field label="Name" htmlFor="course-title">
        <Input id="course-title" name="title" defaultValue={course?.title} required minLength={3} maxLength={120} />
      </Field>
      <Field label="Summary" htmlFor="course-summary" hint="One line on why it matters. Shown on the course list.">
        <Input id="course-summary" name="summary" defaultValue={course?.summary} maxLength={300} />
      </Field>
      <Switch id="course-signoff" name="requiresSignoff" label="A trainer signs it off in person at the end" defaultChecked={course?.requiresSignoff} />
      <Field label="Records a qualification" htmlFor="course-grants" optional hint="On completion, the person gets this qualification, expiring after its validity.">
        <NativeSelect id="course-grants" name="grantsTypeId" defaultValue={course?.grantsType?.id ?? ""} className="min-h-11 w-full">
          <NativeSelectOption value="">None</NativeSelectOption>
          {qualificationTypes.map((q) => <NativeSelectOption key={q.id} value={q.id}>{q.name}{q.validityMonths ? ` (valid ${q.validityMonths} months)` : ""}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
    </FormDialog>
  );
}

export function ArchiveCourse({ id, title, archived }: { id: string; title: string; archived: boolean }) {
  return (
    <ConfirmAction
      trigger={<Button variant="outline" className="min-h-11" aria-label={`${archived ? "Restore" : "Retire"} ${title}`}>{archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}<span className="pc-only-wide">{archived ? "Restore" : "Retire"}</span></Button>}
      title={archived ? `Restore ${title}?` : `Retire ${title}?`}
      description={archived ? "It can be assigned again." : "It can no longer be assigned. Open and finished training on it is kept."}
      confirmLabel={archived ? "Restore" : "Retire course"}
      destructive={!archived}
      successMessage={archived ? "Course restored" : "Course retired"}
      run={() => setCourseArchived(id, !archived)}
    />
  );
}
