"use client";

import { useState } from "react";
import { ChevronDown, UserPlus, UsersRound, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { Field, FormDialog } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { SearchField } from "@/components/ui-kit/search-field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/ui/textarea";
import { today } from "@/lib/format";
import { assignTraining, cancelAssignment } from "@/modules/training/features/assignments/server/actions";
import { THEME } from "@/modules/training/shared/components/dialog-kit";

type Person = { id: string; name: string; jobTitle: string | null; staffRole?: { id: string; name: string } | null };
type CourseOption = { id: string; title: string };

export function AssignTraining({ courses, people, courseId, userIds, label = "Assign training", variant = "default", rowFor }: {
  courses: CourseOption[];
  people: Person[];
  /** Preselect a course (renewals) and people (a person's record). */
  courseId?: string;
  userIds?: string[];
  label?: string;
  variant?: "default" | "outline";
  /** A row action for this record (e.g. the course title): on phones it is an icon button named by it. */
  rowFor?: string;
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
      trigger={rowFor
        ? <Button variant={variant} className="min-h-11" aria-label={`${label} ${rowFor}`}><UserPlus aria-hidden="true" /><span className="pc-only-wide">{label}</span></Button>
        : <Button variant={variant} className="min-h-11"><UserPlus aria-hidden="true" />{label}</Button>}
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
      <Field label="Due by" htmlFor="assign-due" optional>
        <Input id="assign-due" name="dueOn" type="date" min={today()} />
      </Field>
      {fixed ? (
        <p className="text-sm">For {people.filter((p) => chosen.has(p.id)).map((p) => p.name).join(", ")}</p>
      ) : (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold">People ({chosen.size} chosen)</legend>
          {roles.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="min-h-11"><UsersRound aria-hidden="true" />Add everyone on a role<ChevronDown aria-hidden="true" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {roles.map((role) => (
                  <DropdownMenuItem key={role.id} onSelect={() => setChosen((prev) => new Set([...prev, ...role.ids]))}>
                    {role.name} ({role.ids.length})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {/* A live filter: Enter must not submit the assignment. */}
          <div onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}>
            <SearchField label="Filter people" labelHidden placeholder="Name or job title" value={filter} onValueChange={setFilter} />
          </div>
          {/* One scroll: the dialog body scrolls with the footer pinned. */}
          <ul className="pc-rows">
            {shown.map((p) => (
              <li key={p.id}>
                <ChoiceRow
                  type="checkbox"
                  id={`assign-${p.id}`}
                  title={p.name}
                  hint={p.jobTitle ?? undefined}
                  checked={chosen.has(p.id)}
                  onCheckedChange={(on) => setChosen((prev) => { const next = new Set(prev); if (on) next.add(p.id); else next.delete(p.id); return next; })}
                />
              </li>
            ))}
            {shown.length === 0 ? <li className="text-sm text-ui-muted-foreground">Nobody matches.</li> : null}
          </ul>
        </fieldset>
      )}
    </FormDialog>
  );
}

export function CancelTraining({ id, name, title }: { id: string; name: string; title: string }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11"><X aria-hidden="true" />Cancel training</Button>}
      title={`Cancel ${title} for ${name}?`}
      description="It disappears from their Turnfin Me. The record stays in their training history."
      submitLabel="Cancel training"
      destructive
      cancelLabel="Keep it"
      successMessage="Training cancelled"
      submit={(formData) => cancelAssignment(id, String(formData.get("reason") ?? ""))}
    >
      <Field label="Why it is no longer needed" htmlFor="cancel-reason">
        <Textarea id="cancel-reason" name="reason" rows={2} required minLength={3} maxLength={300} autoFocus />
      </Field>
    </FormDialog>
  );
}
