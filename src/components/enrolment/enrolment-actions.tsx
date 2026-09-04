"use client";

import { ArrowRightLeft, ChevronsUp, LogOut, Plus, UserRoundPlus } from "lucide-react";
import { ActionButton } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { SearchablePicker, type PickerOption } from "@/components/searchable-picker";
import { StudentPicker } from "@/components/students/student-search";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  endEnrolment,
  enrolStudent,
  promoteFromWaitlist,
  transferEnrolment,
} from "@/lib/enrolment/actions/enrolment";
import type { TransferTarget } from "@/lib/enrolment/data/enrolments";
import {
  capacityLabel,
  courseLabel,
  formatSlotShort,
  placesLeft,
} from "@/lib/courses/constants";
import { fullName } from "@/lib/students/constants";

type CourseLike = {
  id: string;
  name: string | null;
  dayOfWeek: TransferTarget["dayOfWeek"];
  startMinutes: number;
  capacity: number | null;
  level: { name: string };
};

function courseOptions(courses: (CourseLike & { _count: { enrolments: number } })[]): PickerOption[] {
  return courses.map((course) => {
    const left = placesLeft(course._count.enrolments, course.capacity);
    return {
      value: course.id,
      label: courseLabel(course),
      hint: course.level.name,
      meta: left === null ? "—" : left > 0 ? `${left} free` : "Full",
    };
  });
}

/** The reason field is always present rather than revealed, because the client
 *  cannot know whether a placement is out of sequence until the server has
 *  read the ladder — and a field that appears after a failed submit is a field
 *  people re-type into. */
function PlacementFields() {
  return (
    <>
      <Field
        label="Why this level, if they haven't earned it"
        htmlFor="placementReason"
        hint="Only needed for an out-of-sequence placement — a transfer in, an assessment day, an adult beginner. It goes on their record where an instructor can read it."
      >
        <Textarea
          id="placementReason"
          name="placementReason"
          rows={2}
          placeholder="Assessed at trial on 12 Sep — comfortable at this level"
        />
      </Field>
      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <label htmlFor="allowWaitlist" className="text-[13px] font-medium text-foreground">
          Waitlist if the class is full
          <span className="block text-xs font-normal text-muted-foreground">
            Otherwise a full class refuses, and says so.
          </span>
        </label>
        <Switch id="allowWaitlist" name="allowWaitlist" />
      </div>
    </>
  );
}

function readEnrol(formData: FormData) {
  return {
    studentId: String(formData.get("studentId") ?? ""),
    courseId: String(formData.get("courseId") ?? ""),
    placementReason: String(formData.get("placementReason") ?? ""),
    allowWaitlist: formData.get("allowWaitlist") === "on",
  };
}

/** From a course page: the class is fixed, pick the swimmer. The picker asks
 *  the server as you type rather than being handed every swimmer, which is
 *  why this takes no list. */
export function EnrolIntoCourse({ course, taken }: { course: CourseLike; taken: number }) {
  return (
    <FormDialog
      trigger={
        <Button size="sm">
          <UserRoundPlus className="size-4" />
          Enrol a swimmer
        </Button>
      }
      title={`Enrol into ${courseLabel(course)}`}
      description={`${course.level.name} · ${formatSlotShort(course)} · ${capacityLabel(taken, course.capacity)}`}
      submitLabel="Enrol"
      successMessage="Swimmer enrolled"
      submit={(formData) => enrolStudent(readEnrol(formData))}
    >
      <input type="hidden" name="courseId" value={course.id} />
      <Field label="Swimmer" htmlFor="studentId">
        <StudentPicker id="studentId" name="studentId" />
      </Field>
      <PlacementFields />
    </FormDialog>
  );
}

/** From a student page: the swimmer is fixed, pick the class. */
export function EnrolInCourseForStudent({
  student,
  courses,
}: {
  student: { id: string; firstName: string; lastName: string };
  courses: (CourseLike & { _count: { enrolments: number } })[];
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Enrol in a class
        </Button>
      }
      title={`Enrol ${fullName(student)}`}
      submitLabel="Enrol"
      successMessage="Enrolled"
      submit={(formData) => enrolStudent(readEnrol(formData))}
    >
      <input type="hidden" name="studentId" value={student.id} />
      <Field label="Class" htmlFor="courseId">
        <SearchablePicker
          id="courseId"
          name="courseId"
          options={courseOptions(courses)}
          placeholder="Pick a class"
          searchPlaceholder="Search by class, level or day…"
          emptyText="No class matches that."
        />
      </Field>
      <PlacementFields />
    </FormDialog>
  );
}

type EnrolmentLike = {
  id: string;
  status: string;
  student: { firstName: string; lastName: string };
};

/** The dialogs only ever use the class to name it in a sentence, so they take
 *  the label the caller already computed rather than a course shape they would
 *  have to reassemble. */
type WithClass = { enrolment: EnrolmentLike; classLabel: string };

export function EndEnrolment({ enrolment, classLabel }: WithClass) {
  return (
    <FormDialog
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`End ${fullName(enrolment.student)}'s place in ${classLabel}`}
        >
          <LogOut className="size-3.5" />
        </Button>
      }
      title={`End ${fullName(enrolment.student)}'s place?`}
      description={`They come off the roster for ${classLabel}. Their attendance and marks so far stay exactly as they are.`}
      submitLabel="End place"
      successMessage="Place ended"
      submit={(formData) =>
        endEnrolment(enrolment.id, {
          status: formData.get("finished") === "on" ? "COMPLETED" : "WITHDRAWN",
          note: String(formData.get("note") ?? ""),
        })
      }
    >
      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <label htmlFor="finished" className="text-[13px] font-medium text-foreground">
          They finished the class
          <span className="block text-xs font-normal text-muted-foreground">
            Off means they left it — the log says which.
          </span>
        </label>
        <Switch id="finished" name="finished" />
      </div>
      <Field label="Anything worth recording" htmlFor="note">
        <Textarea id="note" name="note" rows={2} placeholder="Moving to the Tuesday class" />
      </Field>
    </FormDialog>
  );
}

export function PromoteFromWaitlist({ enrolment }: { enrolment: EnrolmentLike }) {
  return (
    <ActionButton
      ariaLabel={`Move ${fullName(enrolment.student)} off the waitlist`}
      title="Move off the waitlist"
      successMessage="Moved off the waitlist"
      run={() => promoteFromWaitlist(enrolment.id)}
    >
      <ChevronsUp className="size-3.5" />
    </ActionButton>
  );
}

export function TransferEnrolment({
  enrolment,
  targets,
}: {
  enrolment: EnrolmentLike;
  targets: TransferTarget[];
}) {
  return (
    <FormDialog
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Move ${fullName(enrolment.student)} to another class`}
        >
          <ArrowRightLeft className="size-3.5" />
        </Button>
      }
      title={`Move ${fullName(enrolment.student)} to another class`}
      description="The old place closes and a new one opens, so their attendance so far stays intact."
      submitLabel="Move"
      successMessage="Swimmer moved"
      submit={(formData) =>
        transferEnrolment(enrolment.id, String(formData.get("toCourseId") ?? ""))
      }
    >
      <Field label="New class" htmlFor="toCourseId">
        <SearchablePicker
          id="toCourseId"
          name="toCourseId"
          options={targets.map((target) => {
            const left = placesLeft(target._count.enrolments, target.capacity);
            return {
              value: target.id,
              label: courseLabel(target),
              hint: `${target.level.name} · ${formatSlotShort(target)}`,
              meta: left === null ? "—" : left > 0 ? `${left} free` : "Full",
            };
          })}
          placeholder="Pick a class"
          searchPlaceholder="Search by class, level or day…"
          emptyText="No other class matches."
        />
      </Field>
    </FormDialog>
  );
}
