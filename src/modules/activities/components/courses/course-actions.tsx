"use client";
import { Button } from "@/components/shadcn/button";

import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DayOfWeek } from "@/generated/prisma/enums";
import {
  setCourseArchived,
  updateCourse,
} from "@/modules/activities/lib/courses/actions/courses";
import {
  DAY_META,
  DAYS_IN_ORDER,
  courseLabel,
  formatTime,
} from "@/modules/activities/lib/courses/constants";
import type { CourseDetail } from "@/modules/activities/lib/courses/data/courses";
import type { InstructorOption } from "@/modules/activities/lib/courses/data/courses";
import type { LevelOption } from "@/modules/activities/lib/curriculum/data/curriculum";

import {
  readCourseInput as readInput,
  UNASSIGNED_INSTRUCTOR as UNASSIGNED,
} from "@/modules/activities/lib/courses/form-input";

function CourseFields({
  course,
  levels,
  instructors,
}: {
  course?: CourseDetail;
  levels: LevelOption[];
  instructors: InstructorOption[];
}) {
  const byProgramme = new Map<
    string,
    { name: string; levels: LevelOption[] }
  >();
  for (const level of levels) {
    const group = byProgramme.get(level.programme.id) ?? {
      name: level.programme.name,
      levels: [],
    };
    group.levels.push(level);
    byProgramme.set(level.programme.id, group);
  }

  return (
    <>
      <Field
        label="Level"
        htmlFor="levelId"
        hint="What this class teaches. It cannot change once anyone is enrolled."
      >
        <Select
          id="levelId"
          name="levelId"
          defaultValue={course?.levelId}
          required
          placeholder="Pick a level"
          options={[...byProgramme.entries()].map(([programmeId, group]) => ({
            id: programmeId,
            title: group.name,
            options: group.levels.map((level) => ({
              value: level.id,
              label: level.name,
            })),
          }))}
        />
      </Field>

      <Field
        label="Name"
        htmlFor="name"
        optional
        hint="Most schools just call it by the level."
      >
        <Input
          id="name"
          name="name"
          defaultValue={course?.name ?? ""}
          placeholder="Dolphins"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Day" htmlFor="dayOfWeek">
          <Select
            id="dayOfWeek"
            name="dayOfWeek"
            defaultValue={course?.dayOfWeek ?? DayOfWeek.MONDAY}
            options={DAYS_IN_ORDER.map((day) => ({
              value: day,
              label: DAY_META[day].label,
            }))}
          />
        </Field>
        <Field label="Starts" htmlFor="startTime">
          <Input
            id="startTime"
            name="startTime"
            type="time"
            required
            defaultValue={course ? formatTime(course.startMinutes) : "16:30"}
          />
        </Field>
        <Field label="Minutes" htmlFor="durationMinutes">
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={5}
            max={240}
            step={5}
            required
            defaultValue={course?.durationMinutes ?? 30}
          />
        </Field>
        <Field label="Capacity" htmlFor="capacity" optional hint="Leave blank for no limit.">
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            max={999}
            defaultValue={course?.capacity ?? ""}
            placeholder="12"
          />
        </Field>
      </div>

      <Field label="Instructor" htmlFor="instructorId">
        <Select
          id="instructorId"
          name="instructorId"
          defaultValue={course?.instructor?.id ?? UNASSIGNED}
          options={[
            { value: UNASSIGNED, label: "Nobody yet" },
            ...instructors.map((instructor) => ({
              value: instructor.id,
              label: instructor.name,
            })),
          ]}
        />
      </Field>

      <Field
        label="Where"
        htmlFor="location"
        optional
        hint="The pool, or the lane."
      >
        <Input
          id="location"
          name="location"
          defaultValue={course?.location ?? ""}
          placeholder="Main pool, lane 3"
        />
      </Field>
    </>
  );
}

export function EditCourse({
  course,
  levels,
  instructors,
}: {
  course: CourseDetail;
  levels: LevelOption[];
  instructors: InstructorOption[];
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline">
          <Pencil aria-hidden={true} className="size-4 shrink-0" />
          Edit
          <span className="sr-only"> {courseLabel(course)}</span>
        </Button>
      }
      title={`Edit ${courseLabel(course)}`}
      width="sm:max-w-xl"
      submitLabel="Save changes"
      successMessage="Class updated"
      submit={(formData) => updateCourse(course.id, readInput(formData))}
    >
      <CourseFields course={course} levels={levels} instructors={instructors} />
    </FormDialog>
  );
}

export function ArchiveCourse({ course }: { course: CourseDetail }) {
  if (course.archivedAt) {
    return (
      <ConfirmAction
        trigger={
          <Button variant="outline">
            <ArchiveRestore aria-hidden={true} className="size-4 shrink-0" />
            Restore
            <span className="sr-only"> {courseLabel(course)}</span>
          </Button>
        }
        title={`Restore ${courseLabel(course)}?`}
        description="It goes back on the timetable and can take enrolments again."
        confirmLabel="Restore"
        successMessage="Class restored"
        run={() => setCourseArchived(course.id, false)}
      />
    );
  }

  return (
    <ConfirmAction
      trigger={
        <Button variant="outline">
          <Archive aria-hidden={true} className="size-4 shrink-0" />
          Archive
          <span className="sr-only"> {courseLabel(course)}</span>
        </Button>
      }
      title={`Archive ${courseLabel(course)}?`}
      description="It comes off the timetable and stops appearing when someone enrols a swimmer. Registers already taken, and everything assessed in it, stay readable. You can restore it later."
      destructive
      confirmLabel="Archive"
      successMessage="Class archived"
      run={() => setCourseArchived(course.id, true)}
    />
  );
}
