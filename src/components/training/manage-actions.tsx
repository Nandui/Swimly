"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Check, Pencil, Plus, RotateCcw, UserPlus, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Label } from "@/components/shadcn/label";
import { Field, FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { today } from "@/lib/format";
import { assignTraining, cancelAssignment, returnForPractice, saveCourse, setCourseArchived, signOffTraining } from "@/lib/training/actions";

/** Training's dialogs. Each carries the Poolside Clear scope into its portal. */
const THEME = "turnfin-module";

type Person = { id: string; name: string; jobTitle: string | null; staffRole?: { id: string; name: string } | null };
type CourseOption = { id: string; title: string };

export function AssignTraining({ courses, people, courseId, userIds, label = "Assign training", variant = "default" }: {
  courses: CourseOption[];
  people: Person[];
  /** Preselect a course (renewals) and people (a person's record). */
  courseId?: string;
  userIds?: string[];
  label?: string;
  variant?: "default" | "outline";
}) {
  const [chosen, setChosen] = useState<Set<string>>(new Set(userIds ?? []));
  const [filter, setFilter] = useState("");
  // Everyone on a role, among the people this person may assign to.
  const roles = [...new Map(people.flatMap((p) => (p.staffRole ? [[p.staffRole.id, p.staffRole.name] as const] : []))).entries()]
    .map(([id, name]) => ({ id, name, ids: people.filter((p) => p.staffRole?.id === id).map((p) => p.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const shown = people.filter((p) => !filter || `${p.name} ${p.jobTitle}`.toLowerCase().includes(filter.toLowerCase()));
  const fixed = !!userIds?.length && people.length <= (userIds?.length ?? 0);
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      trigger={<Button variant={variant} className="min-h-11"><UserPlus aria-hidden="true" />{label}</Button>}
      title={label}
      description="Each person sees it in Turnfin Me with the due date. People who already have this course open are skipped."
      submitLabel="Assign"
      successMessage="Training assigned"
      onOpen={() => { setChosen(new Set(userIds ?? [])); setFilter(""); }}
      submit={(formData) => assignTraining(String(formData.get("courseId") ?? ""), [...chosen], String(formData.get("dueOn") ?? ""))}
    >
      <Field label="Course" htmlFor="assign-course">
        <NativeSelect id="assign-course" name="courseId" defaultValue={courseId ?? courses[0]?.id} required className="min-h-11 w-full">
          {courses.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.title}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Due by (optional)" htmlFor="assign-due">
        <Input id="assign-due" name="dueOn" type="date" min={today()} />
      </Field>
      {fixed ? (
        <p className="text-sm">For {people.filter((p) => chosen.has(p.id)).map((p) => p.name).join(", ")}</p>
      ) : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">People ({chosen.size} chosen)</legend>
          {roles.length > 1 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Choose everyone on a role">
              {roles.map((role) => (
                <Button key={role.id} type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setChosen((prev) => new Set([...prev, ...role.ids]))}>
                  Everyone on {role.name} ({role.ids.length})
                </Button>
              ))}
            </div>
          ) : null}
          <Input aria-label="Filter people" placeholder="Filter by name or job title" value={filter} onChange={(value) => setFilter(value)} />
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {shown.map((p) => (
              <li key={p.id} className="flex min-h-11 items-center gap-3">
                <Checkbox id={`assign-${p.id}`} checked={chosen.has(p.id)} onCheckedChange={(on) => setChosen((prev) => { const next = new Set(prev); if (on) next.add(p.id); else next.delete(p.id); return next; })} />
                <Label htmlFor={`assign-${p.id}`} className="font-normal">{p.name}{p.jobTitle ? <span className="text-ui-muted-foreground"> · {p.jobTitle}</span> : null}</Label>
              </li>
            ))}
            {shown.length === 0 ? <li className="text-sm text-ui-muted-foreground">Nobody matches.</li> : null}
          </ul>
        </fieldset>
      )}
    </FormDialog>
  );
}

type QualificationOption = { id: string; name: string; validityMonths: number | null };
type CourseDraft = { id: string; title: string; summary: string; content: string; requiresSignoff: boolean; grantsType: { id: string } | null };

export function CourseDialog({ course, qualificationTypes }: { course?: CourseDraft; qualificationTypes: QualificationOption[] }) {
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-2xl"
      trigger={course
        ? <Button variant="outline" className="min-h-11"><Pencil aria-hidden="true" />Edit</Button>
        : <Button className="min-h-11"><Plus aria-hidden="true" />New course</Button>}
      title={course ? `Edit ${course.title}` : "New course"}
      description="People read the material in Turnfin Me and mark it done. A practical course then waits for a trainer's sign-off."
      submitLabel={course ? "Save course" : "Add course"}
      successMessage={course ? "Course saved" : "Course added"}
      submit={(formData) => saveCourse(course?.id ?? null, {
        title: String(formData.get("title") ?? ""),
        summary: String(formData.get("summary") ?? ""),
        content: String(formData.get("content") ?? ""),
        requiresSignoff: formData.get("requiresSignoff") === "on",
        grantsTypeId: String(formData.get("grantsTypeId") ?? ""),
      })}
    >
      <Field label="Name" htmlFor="course-title">
        <Input id="course-title" name="title" defaultValue={course?.title} required minLength={3} maxLength={120} />
      </Field>
      <Field label="Summary" htmlFor="course-summary" hint="One line on why it matters. Shown on the course list.">
        <Input id="course-summary" name="summary" defaultValue={course?.summary} maxLength={300} />
      </Field>
      <Field label="What to do" htmlFor="course-content" hint="The material or steps. Links are fine; keep personal details out.">
        <Textarea id="course-content" name="content" defaultValue={course?.content} rows={8} maxLength={10000} />
      </Field>
      <div className="flex min-h-11 items-center gap-3">
        <Switch id="course-signoff" name="requiresSignoff" defaultChecked={course?.requiresSignoff} />
        <Label htmlFor="course-signoff" className="font-normal">A trainer signs it off in person</Label>
      </div>
      <Field label="Records a qualification (optional)" htmlFor="course-grants" hint="On completion, the person gets this qualification, expiring after its validity.">
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
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="ghost" className="min-h-11">{archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}{archived ? "Restore" : "Retire"}</Button>}
      title={archived ? `Restore ${title}?` : `Retire ${title}?`}
      description={archived ? "It can be assigned again." : "It can no longer be assigned. Open and finished training on it is kept."}
      submitLabel={archived ? "Restore" : "Retire course"}
      successMessage={archived ? "Course restored" : "Course retired"}
      submit={() => setCourseArchived(id, !archived)}
    >
      <p className="sr-only">Confirm to continue.</p>
    </FormDialog>
  );
}

export function SignOff({ id, name, title }: { id: string; name: string; title: string }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button className="min-h-11"><Check aria-hidden="true" />Sign off</Button>}
      title={`Sign off ${title} for ${name}?`}
      description="Confirm you watched them do it. It completes the course and records any qualification it grants, verified by you."
      submitLabel="Sign off"
      successMessage="Signed off"
      submit={(formData) => signOffTraining(id, String(formData.get("note") ?? ""))}
    >
      <Field label="Note (optional)" htmlFor="signoff-note" hint="Where and how you checked, for the record.">
        <Textarea id="signoff-note" name="note" rows={3} maxLength={1000} />
      </Field>
    </FormDialog>
  );
}

export function ReturnForPractice({ id, name, title }: { id: string; name: string; title: string }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11"><RotateCcw aria-hidden="true" />Not yet</Button>}
      title={`Not ready to sign off ${title}?`}
      description={`It goes back to ${name} as to do, with your note.`}
      submitLabel="Send back"
      successMessage="Sent back with your note"
      submit={(formData) => returnForPractice(id, String(formData.get("note") ?? ""))}
    >
      <Field label="What to practise" htmlFor="return-note">
        <Textarea id="return-note" name="note" rows={3} required minLength={3} maxLength={1000} autoFocus />
      </Field>
    </FormDialog>
  );
}

export function CancelTraining({ id, name, title }: { id: string; name: string; title: string }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="ghost" className="min-h-11"><X aria-hidden="true" />Cancel</Button>}
      title={`Cancel ${title} for ${name}?`}
      description="It disappears from their Turnfin Me. The record stays in their training history."
      submitLabel="Cancel training"
      successMessage="Training cancelled"
      submit={(formData) => cancelAssignment(id, String(formData.get("reason") ?? ""))}
    >
      <Field label="Why it is no longer needed" htmlFor="cancel-reason">
        <Textarea id="cancel-reason" name="reason" rows={2} required minLength={3} maxLength={300} autoFocus />
      </Field>
    </FormDialog>
  );
}
