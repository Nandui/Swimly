"use client";

import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

/** Radix will not take an empty string as an item value, so "nobody yet" needs
 *  a sentinel that never reaches the action. */
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
        <Select name="levelId" defaultValue={course?.levelId} required>
          <SelectTrigger id="levelId" className="w-full">
            <SelectValue placeholder="Pick a level" />
          </SelectTrigger>
          <SelectContent>
            {[...byProgramme.entries()].map(([programmeId, group]) => (
              <SelectGroup key={programmeId}>
                <SelectLabel>{group.name}</SelectLabel>
                {group.levels.map((level) => (
                  <SelectItem key={level.id} value={level.id}>
                    {level.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Name" htmlFor="name" hint="Optional — most schools just call it by the level.">
        <Input id="name" name="name" defaultValue={course?.name ?? ""} placeholder="Dolphins" />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Day" htmlFor="dayOfWeek">
          <Select name="dayOfWeek" defaultValue={course?.dayOfWeek ?? DayOfWeek.MONDAY}>
            <SelectTrigger id="dayOfWeek" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS_IN_ORDER.map((day) => (
                <SelectItem key={day} value={day}>
                  {DAY_META[day].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <Select name="instructorId" defaultValue={course?.instructor?.id ?? UNASSIGNED}>
          <SelectTrigger id="instructorId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Nobody yet</SelectItem>
            {instructors.map((instructor) => (
              <SelectItem key={instructor.id} value={instructor.id}>
                {instructor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Button size="sm">
          <Plus className="size-4" />
          Add course
        </Button>
      }
      title="Add a course"
      description="A course is one class, at one time, every week."
      submitLabel="Add course"
      successMessage="Course added"
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
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${courseLabel(course)}`}>
            <Pencil className="size-3.5" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        )
      }
      title={`Edit ${courseLabel(course)}`}
      submitLabel="Save changes"
      successMessage="Course updated"
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
        successMessage="Course restored"
        run={() => setCourseArchived(course.id, false)}
      >
        <ArchiveRestore className="size-3.5" />
      </ActionButton>
    );
  }

  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Archive ${courseLabel(course)}`}>
          <Archive className="size-3.5" />
        </Button>
      }
      title={`Archive ${courseLabel(course)}?`}
      description="It comes off the timetable and stops appearing when someone enrols a swimmer. Registers already taken, and everything assessed in it, stay readable. You can restore it later."
      confirmLabel="Archive"
      successMessage="Course archived"
      run={() => setCourseArchived(course.id, true)}
    />
  );
}
