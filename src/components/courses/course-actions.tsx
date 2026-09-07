"use client";

import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DayOfWeek } from "@/generated/prisma/enums";
import {
  createCourse,
  setCourseArchived,
  updateCourse,
  type CourseInput,
} from "@/lib/courses/actions/courses";
import { DAY_META, DAYS_IN_ORDER, courseLabel, formatTime } from "@/lib/courses/constants";
import type { CourseDetail } from "@/lib/courses/data/courses";
import type { InstructorOption } from "@/lib/courses/data/courses";
import type { LevelOption } from "@/lib/curriculum/data/curriculum";
import { Icon } from "@astryxdesign/core/Icon";

/** Keep the unassigned choice distinct from a picker without a selection. */
const UNASSIGNED = "__unassigned__";

function readInput(formData: FormData): CourseInput {
  const text = (key: string) => String(formData.get(key) ?? "");
  const instructorId = text("instructorId");
  return {
    levelId: text("levelId"),
    name: text("name"),
    dayOfWeek: text("dayOfWeek") as CourseInput["dayOfWeek"],
    startTime: text("startTime"),
    durationMinutes: text("durationMinutes"),
    capacity: text("capacity"),
    instructorId: instructorId === UNASSIGNED ? "" : instructorId,
    location: text("location"),
  };
}

function CourseFields({
  course,
  levels,
  instructors,
}: {
  course?: CourseDetail;
  levels: LevelOption[];
  instructors: InstructorOption[];
}) {
  const byProgramme = new Map<string, { name: string; levels: LevelOption[] }>();
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
      <Field label="Level" htmlFor="levelId" hint="What this class teaches. It cannot change once anyone is enrolled.">
        <Select
          id="levelId"
          name="levelId"
          defaultValue={course?.levelId}
          required
          placeholder="Pick a level"
          options={[...byProgramme.values()].map((group) => ({
            title: group.name,
            options: group.levels.map((level) => ({ value: level.id, label: level.name })),
          }))}
        />
      </Field>

      <Field label="Name" htmlFor="name" hint="Optional — most schools just call it by the level.">
        <Input id="name" name="name" defaultValue={course?.name ?? ""} placeholder="Dolphins" />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Day" htmlFor="dayOfWeek">
          <Select
            id="dayOfWeek"
            name="dayOfWeek"
            defaultValue={course?.dayOfWeek ?? DayOfWeek.MONDAY}
            options={DAYS_IN_ORDER.map((day) => ({ value: day, label: DAY_META[day].label }))}
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
        <Field label="Capacity" htmlFor="capacity" hint="Blank means uncapped.">
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
            ...instructors.map((instructor) => ({ value: instructor.id, label: instructor.name })),
          ]}
        />
      </Field>

      <Field label="Where" htmlFor="location" hint="Optional — the pool, or the lane.">
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

export function AddCourse({
  levels,
  instructors,
}: {
  levels: LevelOption[];
  instructors: InstructorOption[];
}) {
  return (
    <FormDialog
      trigger={
        <Button label="Add class" variant="primary" size="sm" icon={<Icon icon={Plus} size="sm" />} />
      }
      title="Add a class"
      width="sm:max-w-xl"
      description="One level, one time, every week."
      submitLabel="Add class"
      successMessage="Class added"
      submit={(formData) => createCourse(readInput(formData))}
    >
      <CourseFields levels={levels} instructors={instructors} />
    </FormDialog>
  );
}

export function EditCourse({
  course,
  levels,
  instructors,
  variant = "icon",
}: {
  course: CourseDetail;
  levels: LevelOption[];
  instructors: InstructorOption[];
  variant?: "icon" | "button";
}) {
  return (
    <FormDialog
      trigger={
        variant === "icon" ? (
          <IconButton label={`Edit ${courseLabel(course)}`} variant="ghost" size="sm" icon={<Icon icon={Pencil} size="sm" />} />
        ) : (
          <Button label="Edit" variant="secondary" size="sm" icon={<Icon icon={Pencil} size="sm" />} />
        )
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
      <ActionButton
        ariaLabel={`Restore ${courseLabel(course)}`}
        successMessage="Class restored"
        run={() => setCourseArchived(course.id, false)}
      >
        <Icon icon={ArchiveRestore} size="sm" />
      </ActionButton>
    );
  }

  return (
    <ConfirmAction
      trigger={
        <IconButton label={`Archive ${courseLabel(course)}`} variant="ghost" size="sm" icon={<Icon icon={Archive} size="sm" />} />
      }
      title={`Archive ${courseLabel(course)}?`}
      description="It comes off the timetable and stops appearing when someone enrols a swimmer. Registers already taken, and everything assessed in it, stay readable. You can restore it later."
      confirmLabel="Archive"
      successMessage="Class archived"
      run={() => setCourseArchived(course.id, true)}
    />
  );
}
