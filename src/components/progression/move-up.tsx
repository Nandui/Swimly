"use client";

import { ArrowUpRight } from "lucide-react";
import { Field, FormDialog } from "@/components/form-dialog";
import { SearchablePicker, type PickerOption } from "@/components/searchable-picker";
import { Button } from "@/components/ui/button";
import type { DayOfWeek } from "@/generated/prisma/client";
import { courseLabel, placesLeft } from "@/lib/courses/constants";
import { enrolStudent, transferEnrolment } from "@/lib/enrolment/actions/enrolment";

/** A class a swimmer could be moved into. Structurally what `getCourses`
 *  already returns, so the pages hand over the list they had loaded anyway. */
export type MoveTarget = {
  id: string;
  name: string | null;
  dayOfWeek: DayOfWeek;
  startMinutes: number;
  capacity: number | null;
  archivedAt: Date | null;
  level: { id: string; name: string };
  _count: { enrolments: number };
};

/** Moving up, once the level below is signed off and confirmed.
 *
 *  Deliberately gated on the **completion**, not on the last competency being
 *  ticked. All-passed makes a swimmer eligible; a person still says they are
 *  done, and only then is the rung above theirs. Offering the move a step
 *  earlier would walk straight into the placement guard and demand a reason
 *  for something they had in fact earned.
 *
 *  It closes the old place and opens a new one rather than re-pointing the
 *  enrolment, because attendance hangs off (course, student, date) — rewriting
 *  the enrolment would orphan every register they were already on. */
export function MoveUpToLevel({
  studentName,
  studentId,
  fromEnrolmentId,
  fromClassLabel,
  nextLevelId,
  nextLevelName,
  courses,
}: {
  studentName: string;
  studentId: string;
  /** Their open place at the level just completed, if they have one. */
  fromEnrolmentId: string | null;
  fromClassLabel: string | null;
  nextLevelId: string;
  nextLevelName: string;
  courses: MoveTarget[];
}) {
  const targets = courses.filter(
    (course) => course.level.id === nextLevelId && !course.archivedAt
  );

  // The kit's rule for a case that is never allowed: disable the trigger and
  // say why, rather than letting the click through to an error.
  if (targets.length === 0) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled
        title={`No class teaches ${nextLevelName} yet. Add one on the Courses page first.`}
      >
        <ArrowUpRight className="size-4" />
        Move up to {nextLevelName}
      </Button>
    );
  }

  const options: PickerOption[] = targets.map((course) => {
    const left = placesLeft(course._count.enrolments, course.capacity);
    return {
      value: course.id,
      label: courseLabel(course),
      hint: course.level.name,
      meta: left === null ? "—" : left > 0 ? `${left} free` : "Full",
    };
  });

  return (
    <FormDialog
      trigger={
        <Button size="sm">
          <ArrowUpRight className="size-4" />
          Move up to {nextLevelName}
        </Button>
      }
      title={`Move ${studentName} up to ${nextLevelName}`}
      description={
        fromEnrolmentId
          ? `Their place in ${fromClassLabel} closes and a new one opens in the class you pick. Every register they are already on stays exactly as it is.`
          : `They are not in a class at the moment, so this simply enrols them at ${nextLevelName}.`
      }
      submitLabel="Move up"
      successMessage={`Moved up to ${nextLevelName}`}
      submit={(formData) => {
        const toCourseId = String(formData.get("toCourseId") ?? "");
        return fromEnrolmentId
          ? transferEnrolment(fromEnrolmentId, toCourseId)
          : enrolStudent({
              studentId,
              courseId: toCourseId,
              // They earned this rung, so there is nothing to explain — and no
              // waitlisting, because giving up a place they hold for a place
              // they might get is not a move up.
              placementReason: "",
              allowWaitlist: false,
            });
      }}
    >
      <Field label={`Which ${nextLevelName} class`} htmlFor="toCourseId">
        <SearchablePicker
          id="toCourseId"
          name="toCourseId"
          options={options}
          placeholder="Pick a class"
          searchPlaceholder="Search by class or day…"
          emptyText={`No ${nextLevelName} class matches that.`}
        />
      </Field>
    </FormDialog>
  );
}
