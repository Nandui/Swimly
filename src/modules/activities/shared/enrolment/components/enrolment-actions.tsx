"use client";
import { Button } from "@/components/shadcn/button";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";

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
import { scheduleUnenrolment } from "@/modules/activities/shared/enrolment/actions/schedule";
import { toDateOnlyString, today, parseDateOnly } from "@/lib/format";

import { LegendAgreementField } from "@/modules/activities/shared/enrolment/components/legend-agreement-field";
import { readLegendAgreement } from "@/modules/activities/shared/enrolment/legend-agreement";
import { Field, FormDialog } from "@/components/form-dialog";
import {
  SearchablePicker,
  type PickerOption,
} from "@/components/searchable-picker";
import { StudentPicker } from "@/modules/activities/shared/students/components/student-search";

import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  endEnrolment,
  enrolStudent,
  promoteFromWaitlist,
  transferEnrolment,
} from "@/modules/activities/shared/enrolment/actions/enrolment";
import type { TransferTarget } from "@/modules/activities/shared/enrolment/data/enrolments";
import {
  capacityLabel,
  courseLabelWithSite as courseLabel,
  formatSlotShort,
  placesLeft,
} from "@/modules/activities/shared/courses/constants";
import { fullName } from "@/modules/activities/shared/students/constants";

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
function SiteClassPicker({
  id,
  name,
  courses,
  label = "Class",
  onValueChange,
}: {
  id: string;
  name: string;
  courses: (CourseLike & { _count: { enrolments: number } })[];
  label?: string;
  onValueChange?: (value: string) => void;
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
        onValueChange={value => { setSite(value); onValueChange?.(""); }}
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
          onValueChange={onValueChange}
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
        placeholder="Assessed at trial on 12 Sep, comfortable at this level"
      />
    </Field>
  );
}

function PlacementFields({ full = false, agreementKey }: { full?: boolean; agreementKey?: string }) {
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
      <LegendAgreementField key={agreementKey} required={!full} />
    </>
  );
}

function readEnrol(formData: FormData) {
  return {
    studentId: String(formData.get("studentId") ?? ""),
    courseId: String(formData.get("courseId") ?? ""),
    placementReason: String(formData.get("placementReason") ?? ""),
    allowWaitlist: formData.get("allowWaitlist") === "on",
    legendAgreement: readLegendAgreement(formData),
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
  const [selectedId, setSelectedId] = useState("");
  return (
    <FormDialog
      onOpen={() => setSelectedId("")}
      trigger={
        <Button variant="default">
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
        <StudentPicker id={id} name="studentId" onValueChange={setSelectedId} />
      </Field>
      <PlacementFields agreementKey={selectedId} full={placesLeft(taken, course.capacity) === 0} />
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
  const [selectedId, setSelectedId] = useState("");
  const selected = courses.find(course => course.id === selectedId);
  return (
    <FormDialog
      onOpen={() => setSelectedId("")}
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
      <SiteClassPicker id={id} name="courseId" courses={courses} onValueChange={setSelectedId} />
      <PlacementFields agreementKey={selectedId} full={!!selected && placesLeft(selected._count.enrolments, selected.capacity) === 0} />
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
};

/** Row actions are labelled outline buttons; the visible words lead the
 *  accessible name and the swimmer and class follow for screen readers. */
export function EndEnrolment({
  enrolment,
  classLabel,
}: WithClass) {
  const id = useId();
  const [when, setWhen] = useState(enrolment.scheduledEndOn ? "date" : "now");
  const name = fullName(enrolment.student);
  return (
    <FormDialog
      onOpen={() => setWhen(enrolment.scheduledEndOn ? "date" : "now")}
      trigger={
        <Button variant="outline">
          <LogOut aria-hidden={true} className="size-4 shrink-0" />
          {enrolment.scheduledEndOn ? "Change unenrolment" : "Unenrol"}
          <span className="sr-only"> {name} from {classLabel}</span>
        </Button>
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
        <SegmentedChoice
          value={when}
          aria-label="When to unenrol"
          onValueChange={setWhen}
          fill="phone"
          options={[
            { value: "now", label: "Now" },
            { value: "date", label: "On a date" },
            ...(enrolment.scheduledEndOn ? [{ value: "keep", label: "Keep place" }] : []),
          ]}
        />
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
  classLabel,
}: {
  enrolment: EnrolmentLike;
  classLabel?: string;
}) {
  return <FormDialog
    trigger={<Button>
      <ChevronsUp aria-hidden="true" />
      Enrol from waitlist
      <span className="sr-only"> {fullName(enrolment.student)}{classLabel ? ` for ${classLabel}` : ""}</span>
    </Button>}
    title={`Enrol ${fullName(enrolment.student)} from the waitlist`}
    description={`Their place in ${classLabel ?? "this class"} becomes active if a seat is available.`}
    submitLabel="Enrol from waitlist" successMessage={`Enrolled in ${classLabel ?? "the class"}`}
    submit={data => promoteFromWaitlist(enrolment.id, readLegendAgreement(data))}>
    <LegendAgreementField />
  </FormDialog>;
}

export function TransferEnrolment({
  enrolment,
  targets,
  classLabel,
}: {
  enrolment: EnrolmentLike;
  targets: TransferTarget[];
  classLabel?: string;
}) {
  const id = useId();
  return (
    <FormDialog
      trigger={
        <Button variant="outline">
          <ArrowRightLeft aria-hidden={true} className="size-4 shrink-0" />
          Move swimmer
          <span className="sr-only"> {fullName(enrolment.student)}{classLabel ? ` from ${classLabel}` : ""}</span>
        </Button>
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
