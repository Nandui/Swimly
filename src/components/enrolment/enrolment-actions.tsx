"use client";

import { ArrowRightLeft, ChevronsUp, LogOut, Plus, UserRoundPlus } from "lucide-react";
import { ActionButton } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { SearchablePicker, type PickerOption } from "@/components/searchable-picker";
import { StudentPicker } from "@/components/students/student-search";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
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
import { Icon } from "@astryxdesign/core/Icon";

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
function PlacementReason() {
  return (
    <Field
      label="Why this level, if they haven't earned it"
      htmlFor="placementReason"
      hint="Only needed when they have not earned this level. Record what supports the placement so their instructor can read it."
    >
      <Textarea
        id="placementReason"
        name="placementReason"
        rows={2}
        placeholder="Assessed at trial on 12 Sep — comfortable at this level"
      />
    </Field>
  );
}

function PlacementFields() {
  return (
    <>
      <PlacementReason />
      <Switch
        id="allowWaitlist"
        name="allowWaitlist"
        label="Waitlist if the class is full"
        description="Otherwise a full class refuses, and says so."
        labelSpacing="spread"
      />
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
        <Button label="Enrol a swimmer" variant="primary" size="sm" icon={<Icon icon={UserRoundPlus} size="sm" />} />
      }
      title={`Enrol into ${courseLabel(course)}`}
      description={`${course.level.name} · ${formatSlotShort(course)} · ${capacityLabel(taken, course.capacity)}`}
      submitLabel="Enrol"
      successMessage="Swimmer enrolled"
      submit={(formData, confirmation) => enrolStudent(readEnrol(formData), confirmation)}
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
        <Button label="Enrol in a class" variant="secondary" size="sm" icon={<Icon icon={Plus} size="sm" />} />
      }
      title={`Enrol ${fullName(student)}`}
      submitLabel="Enrol"
      successMessage="Enrolled"
      submit={(formData, confirmation) => enrolStudent(readEnrol(formData), confirmation)}
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
type WithClass = { enrolment: EnrolmentLike; classLabel: string; variant?: "icon" | "button" };

export function EndEnrolment({ enrolment, classLabel, variant = "icon" }: WithClass) {
  return (
    <FormDialog
      trigger={
        variant === "button"
          ? <Button label="Unenrol" aria-label={`Unenrol ${fullName(enrolment.student)} from ${classLabel}`} variant="secondary" icon={<Icon icon={LogOut} size="sm" />} />
          : <IconButton label={`End ${fullName(enrolment.student)}'s place in ${classLabel}`} variant="ghost" size="sm" icon={<Icon icon={LogOut} size="sm" />} />
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
      <Switch
        id="finished"
        name="finished"
        label="They finished the class"
        description="Off means they left it — the log says which."
        labelSpacing="spread"
      />
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
      <Icon icon={ChevronsUp} size="sm" />
    </ActionButton>
  );
}

export function TransferEnrolment({
  enrolment,
  targets,
  variant = "icon",
  classLabel,
}: {
  enrolment: EnrolmentLike;
  targets: TransferTarget[];
  variant?: "icon" | "button";
  classLabel?: string;
}) {
  return (
    <FormDialog
      trigger={
        variant === "button"
          ? <Button label="Move swimmer" aria-label={`Move ${fullName(enrolment.student)}${classLabel ? ` from ${classLabel}` : ""} to another class`} variant="secondary" icon={<Icon icon={ArrowRightLeft} size="sm" />} />
          : <IconButton label={`Move ${fullName(enrolment.student)} to another class`} variant="ghost" size="sm" icon={<Icon icon={ArrowRightLeft} size="sm" />} />
      }
      title={`Move ${fullName(enrolment.student)} to another class`}
      description={`${classLabel ? `From ${classLabel}. ` : ""}The old place closes and a new one opens, so their attendance so far stays intact.`}
      submitLabel="Move"
      successMessage="Swimmer moved"
      submit={(formData, confirmation) =>
        transferEnrolment(
          enrolment.id,
          String(formData.get("toCourseId") ?? ""),
          String(formData.get("placementReason") ?? ""),
          confirmation
        )
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
      <PlacementReason />
    </FormDialog>
  );
}
