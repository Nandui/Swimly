"use client";
import { Button } from "@/components/shadcn/button";
import { RadioGroupItem, RadioGroup } from "@/components/shadcn/radio-group";

import { useId, useState } from "react";

import {
  ArrowRightLeft,
  ChevronsUp,
  LogOut,
  Plus,
  UserRoundPlus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { scheduleUnenrolment } from "@/lib/enrolment/actions/schedule";
import { toDateOnlyString, today, parseDateOnly } from "@/lib/format";

import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import {
  SearchablePicker,
  type PickerOption,
} from "@/components/searchable-picker";
import { StudentPicker } from "@/components/students/student-search";

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
  courseLabelWithSite as courseLabel,
  formatSlotShort,
  placesLeft,
} from "@/lib/courses/constants";
import { fullName } from "@/lib/students/constants";

type CourseLike = {
  id: string;
  name: string | null;
  club?: { id: string; name: string };
  dayOfWeek: TransferTarget["dayOfWeek"];
  startMinutes: number;
  capacity: number | null;
  level: { name: string };
};

function courseOptions(
  courses: (CourseLike & { _count: { enrolments: number } })[],
): PickerOption[] {
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

/** A local filter: selecting a destination never changes the working site.
 * Remount the picker when the site changes so a hidden old selection cannot submit. */
export function SiteClassPicker({
  id,
  name,
  courses,
  label = "Class",
}: {
  id: string;
  name: string;
  courses: (CourseLike & { _count: { enrolments: number } })[];
  label?: string;
}) {
  const [site, setSite] = useState("any");
  const sites = [
    ...new Map(
      courses.flatMap((c) => (c.club ? [[c.club.id, c.club] as const] : [])),
    ).values(),
  ];
  const filtered = courses.filter((c) => site === "any" || c.club?.id === site);
  return (
    <>
      <Select
        label="Site"
        value={site}
        onValueChange={setSite}
        options={[
          { value: "any", label: "All sites" },
          ...sites.map((s) => ({ value: s.id, label: s.name })),
        ]}
      />
      <Field label={label} htmlFor={id}>
        <SearchablePicker
          key={site}
          id={id}
          name={name}
          options={courseOptions(filtered)}
          placeholder="Pick a class"
          searchPlaceholder="Search by class, level, site or day…"
          emptyText="No class matches at this site."
        />
      </Field>
    </>
  );
}

/** The reason field is always present rather than revealed, because the client
 *  cannot know whether a placement is out of sequence until the server has
 *  read the ladder — and a field that appears after a failed submit is a field
 *  people re-type into. */
function PlacementReason() {
  const id = useId();
  return (
    <Field
      label="Why this level, if they haven't earned it"
      htmlFor={id}
      hint="Only needed when they have not earned this level. Record what supports the placement so their instructor can read it."
    >
      <Textarea
        id={id}
        name="placementReason"
        rows={2}
        placeholder="Assessed at trial on 12 Sep — comfortable at this level"
      />
    </Field>
  );
}

function PlacementFields() {
  const id = useId();
  return (
    <>
      <PlacementReason />
      <Switch
        id={id}
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
export function EnrolIntoCourse({
  course,
  taken,
}: {
  course: CourseLike;
  taken: number;
}) {
  const id = useId();
  return (
    <FormDialog
      trigger={
        <Button variant="default" size="sm">
          {<UserRoundPlus aria-hidden={true} className="size-4 shrink-0" />}
          {"Enrol a swimmer"}
        </Button>
      }
      title={`Enrol into ${courseLabel(course)}`}
      description={`${course.level.name} · ${formatSlotShort(course)} · ${capacityLabel(taken, course.capacity)}`}
      submitLabel="Enrol"
      successMessage="Swimmer enrolled"
      submit={(formData, confirmation) =>
        enrolStudent(readEnrol(formData), confirmation)
      }
    >
      <input type="hidden" name="courseId" value={course.id} />
      <Field label="Swimmer" htmlFor={id}>
        <StudentPicker id={id} name="studentId" />
      </Field>
      <PlacementFields />
    </FormDialog>
  );
}

/** From a student page: the swimmer is fixed, pick the class. */
export function EnrolInCourseForStudent({
  student,
  courses,
  variant = "outline",
  label = "Enrol in a class",
}: {
  student: { id: string; firstName: string; lastName: string };
  courses: (CourseLike & { _count: { enrolments: number } })[];
  variant?: "default" | "outline";
  label?: string;
}) {
  const id = useId();
  return (
    <FormDialog
      trigger={
        <Button variant={variant} size="default">
          {<Plus aria-hidden={true} className="size-4 shrink-0" />}
          {label}
        </Button>
      }
      title={`Enrol ${fullName(student)}`}
      submitLabel="Enrol"
      successMessage="Enrolled"
      submit={(formData, confirmation) =>
        enrolStudent(readEnrol(formData), confirmation)
      }
    >
      <input type="hidden" name="studentId" value={student.id} />
      <SiteClassPicker id={id} name="courseId" courses={courses} />
      <PlacementFields />
    </FormDialog>
  );
}

type EnrolmentLike = {
  id: string;
  status: string;
  scheduledEndOn?: Date | null;
  student: { firstName: string; lastName: string };
};

/** The dialogs only ever use the class to name it in a sentence, so they take
 *  the label the caller already computed rather than a course shape they would
 *  have to reassemble. */
type WithClass = {
  enrolment: EnrolmentLike;
  classLabel: string;
  variant?: "icon" | "button";
};

export function EndEnrolment({
  enrolment,
  classLabel,
  variant = "icon",
}: WithClass) {
  const id = useId();
  const [when, setWhen] = useState(enrolment.scheduledEndOn ? "date" : "now");
  const name = fullName(enrolment.student);
  return (
    <FormDialog
      onOpen={() => setWhen(enrolment.scheduledEndOn ? "date" : "now")}
      trigger={
        variant === "button" ? (
          <Button
            aria-label={`Unenrolment for ${name} in ${classLabel}`}
            variant="outline"
          >
            {<LogOut aria-hidden={true} className="size-4 shrink-0" />}
            {enrolment.scheduledEndOn ? "Change unenrolment" : "Unenrol"}
          </Button>
        ) : (
          <Button
            variant="ghost"
            aria-label={`Unenrol ${name} from ${classLabel}`}
            size="icon-sm"
          >
            {<LogOut aria-hidden={true} className="size-4 shrink-0" />}
          </Button>
        )
      }
      title={`Unenrol ${name}`}
      description={`${classLabel}. Attendance and marks stay on record. Choose when their place should end.`}
      submitLabel={
        when === "date"
          ? "Save end date"
          : when === "keep"
            ? "Keep place"
            : "Unenrol now"
      }
      successMessage={
        when === "date"
          ? `Unenrolment scheduled for ${classLabel}`
          : when === "keep"
            ? `Place kept in ${classLabel}`
            : `Unenrolled from ${classLabel}`
      }
      submit={(data) =>
        when === "date"
          ? scheduleUnenrolment(enrolment.id, String(data.get("endDate") ?? ""))
          : when === "keep"
            ? scheduleUnenrolment(enrolment.id, null)
            : endEnrolment(enrolment.id, {
                status:
                  data.get("finished") === "on" ? "COMPLETED" : "WITHDRAWN",
                note: String(data.get("note") ?? ""),
              })
      }
    >
      {enrolment.status === "ACTIVE" ? (
        <RadioGroup
          value={when}
          aria-label="When to unenrol"
          onValueChange={setWhen}
          className={
            "inline-flex flex-wrap gap-1 rounded-ui-lg bg-ui-muted p-1"
          }
        >
          <RadioGroupItem
            value="now"
            className={
              "aspect-auto h-auto min-h-11 w-auto flex-1 bg-transparent dark:bg-transparent dark:data-[state=checked]:bg-ui-input/30 rounded-ui-md border-0 px-3 py-2 text-sm font-medium shadow-none data-[state=checked]:bg-ui-background data-[state=checked]:text-ui-foreground data-[state=checked]:shadow-sm"
            }
          >
            {"Now"}
          </RadioGroupItem>
          <RadioGroupItem
            value="date"
            className={
              "aspect-auto h-auto min-h-11 w-auto flex-1 bg-transparent dark:bg-transparent dark:data-[state=checked]:bg-ui-input/30 rounded-ui-md border-0 px-3 py-2 text-sm font-medium shadow-none data-[state=checked]:bg-ui-background data-[state=checked]:text-ui-foreground data-[state=checked]:shadow-sm"
            }
          >
            {"On a date"}
          </RadioGroupItem>
          {enrolment.scheduledEndOn ? (
            <RadioGroupItem
              value="keep"
              className={
                "aspect-auto h-auto min-h-11 w-auto flex-1 bg-transparent dark:bg-transparent dark:data-[state=checked]:bg-ui-input/30 rounded-ui-md border-0 px-3 py-2 text-sm font-medium shadow-none data-[state=checked]:bg-ui-background data-[state=checked]:text-ui-foreground data-[state=checked]:shadow-sm"
              }
            >
              {"Keep place"}
            </RadioGroupItem>
          ) : null}
        </RadioGroup>
      ) : null}
      {when === "date" ? (
        <Field
          label="Unenrol on"
          htmlFor={`${id}-date`}
          hint="They keep their place until this date. Unenrolment takes effect when the app is next used on or after that day."
        >
          <Input
            id={`${id}-date`}
            name="endDate"
            type="date"
            required
            min={toDateOnlyString(
              new Date(parseDateOnly(today()).getTime() + 86_400_000),
            )}
            defaultValue={
              enrolment.scheduledEndOn
                ? toDateOnlyString(enrolment.scheduledEndOn)
                : undefined
            }
          />
        </Field>
      ) : when === "keep" ? (
        <p className="text-sm text-ui-foreground">
          This cancels the scheduled unenrolment. They stay in this class.
        </p>
      ) : (
        <>
          <Switch
            id={`${id}-finished`}
            name="finished"
            label="They finished the class"
            description="Leave off if they are withdrawing before completion."
            labelSpacing="spread"
          />
          <Field label="Anything worth recording" htmlFor={`${id}-note`}>
            <Textarea
              id={`${id}-note`}
              name="note"
              rows={2}
              placeholder="Reason for leaving this class"
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

export function PromoteFromWaitlist({
  enrolment,
  variant = "icon",
  classLabel,
}: {
  enrolment: EnrolmentLike;
  variant?: "icon" | "button";
  classLabel?: string;
}) {
  if (variant === "button")
    return (
      <ConfirmAction
        trigger={
          <Button
            aria-label={`Enrol ${fullName(enrolment.student)} from the waitlist${classLabel ? ` for ${classLabel}` : ""}`}
            variant="outline"
          >
            {"Enrol from waitlist"}
          </Button>
        }
        title={`Enrol ${fullName(enrolment.student)} from the waitlist?`}
        description={`Their place in ${classLabel ?? "this class"} becomes active if a seat is available.`}
        confirmLabel="Enrol from waitlist"
        successMessage={`Enrolled in ${classLabel ?? "the class"}`}
        run={() => promoteFromWaitlist(enrolment.id)}
      />
    );
  return (
    <ActionButton
      ariaLabel={`Move ${fullName(enrolment.student)} off the waitlist`}
      title="Move off the waitlist"
      successMessage="Moved off the waitlist"
      run={() => promoteFromWaitlist(enrolment.id)}
    >
      <ChevronsUp aria-hidden={true} className="size-4 shrink-0" />
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
  const id = useId();
  return (
    <FormDialog
      trigger={
        variant === "button" ? (
          <Button
            aria-label={`Move ${fullName(enrolment.student)}${classLabel ? ` from ${classLabel}` : ""} to another class`}
            variant="outline"
          >
            {<ArrowRightLeft aria-hidden={true} className="size-4 shrink-0" />}
            {"Move swimmer"}
          </Button>
        ) : (
          <Button
            variant="ghost"
            aria-label={`Move ${fullName(enrolment.student)} to another class`}
            size="icon-sm"
          >
            {<ArrowRightLeft aria-hidden={true} className="size-4 shrink-0" />}
          </Button>
        )
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
          confirmation,
        )
      }
    >
      <SiteClassPicker
        id={id}
        name="toCourseId"
        courses={targets}
        label="New class"
      />
      <PlacementReason />
    </FormDialog>
  );
}
