"use client";
import { LocationField } from "@/modules/activities/shared/components/location-field";
import { Button } from "@/components/shadcn/button";

import * as React from "react";
import { CalendarPlus, Pencil, Ban } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelSession,
  createSession,
  updateSession,
  type SessionInput,
} from "@/modules/activities/features/assessments/server/actions/sessions";
import { sessionLabel } from "@/modules/activities/shared/assessments/constants";
import type {
  AssessmentTypeOption,
  ProgrammeOption,
  SessionRow,
} from "@/modules/activities/shared/assessments/data/assessments";
import type { InstructorOption } from "@/modules/activities/shared/courses/data/courses";
import { formatTime } from "@/modules/activities/shared/courses/constants";
import { toDateOnlyString } from "@/lib/format";

const NONE = "__none__";

function readInput(formData: FormData): SessionInput {
  const text = (key: string) => String(formData.get(key) ?? "");
  const instructor = text("instructorId");
  return {
    programmeId: text("programmeId"),
    typeId: text("typeId"),
    date: text("date"),
    start: text("start"),
    durationMinutes: Number(text("durationMinutes") || 30),
    capacity: text("capacity"),
    minAge: text("minAge"),
    maxAge: text("maxAge"),
    location: text("location"),
    instructorId: instructor === NONE ? "" : instructor,
    notes: text("notes"),
  };
}

type FieldProps = {
  session?: SessionRow;
  programmes: ProgrammeOption[];
  types: AssessmentTypeOption[];
  instructors: InstructorOption[];
  today: string;
};

/** The programme is held in state rather than left to the form, because the
 *  kinds of assessment on offer are the chosen programme's and nothing else:
 *  change the programme and the list changes with it. */
function SessionFields({
  session,
  programmes,
  types,
  instructors,
  today,
}: FieldProps) {
  const [programmeId, setProgrammeId] = React.useState(
    session?.programmeId ?? programmes[0]?.id ?? "",
  );
  const kinds = types.filter((type) => type.programmeId === programmeId);
  const currentKind =
    session && session.programmeId === programmeId
      ? (session.typeId ?? undefined)
      : undefined;

  return (
    <>
      <div
        className={
          "min-w-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,var(--pc-card-min)),1fr))] gap-4"
        }
      >
        <Field
          label="Programme"
          htmlFor="programmeId"
          hint="What the assessor places children into."
        >
          <Select
            id="programmeId"
            name="programmeId"
            value={programmeId}
            onValueChange={setProgrammeId}
            placeholder="Pick a programme"
            options={programmes.map((programme) => ({
              value: programme.id,
              label: programme.name,
            }))}
          />
        </Field>
        <Field
          label="Kind"
          htmlFor="typeId"
          hint={
            kinds.length === 0
              ? "This programme has no kinds of assessment yet. Add them on its page under Programmes."
              : "Who this session is for."
          }
        >
          {/* Keyed on the programme so the default resets when it changes,
              rather than pointing at a kind from the previous list. */}
          <Select
            key={programmeId}
            id="typeId"
            name="typeId"
            defaultValue={currentKind ?? kinds[0]?.id}
            disabled={kinds.length === 0}
            placeholder={kinds.length === 0 ? "None yet" : "Pick a kind"}
            options={kinds.map((kind) => ({
              value: kind.id,
              label: kind.name,
            }))}
          />
        </Field>
      </div>

      <div
        className={
          "min-w-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,var(--pc-card-min)),1fr))] gap-4"
        }
      >
        <Field label="Date" htmlFor="date">
          <Input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={session ? toDateOnlyString(session.date) : today}
          />
        </Field>
        <Field label="Start" htmlFor="start" hint="24-hour, like 13:30.">
          <Input
            id="start"
            name="start"
            type="time"
            required
            defaultValue={session ? formatTime(session.startMinutes) : ""}
          />
        </Field>
        <Field label="Minutes" htmlFor="durationMinutes">
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={5}
            max={240}
            defaultValue={session?.durationMinutes ?? 30}
          />
        </Field>
      </div>

      <div
        className={
          "min-w-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,var(--pc-card-min)),1fr))] gap-4"
        }
      >
        <Field
          label="Places"
          htmlFor="capacity"
          hint="Leave blank for no limit."
        >
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            defaultValue={session?.capacity ?? ""}
          />
        </Field>
        <LocationField label="Pool" defaultValue={session?.location} />
      </div>

      <div
        className={
          "min-w-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,var(--pc-card-min)),1fr))] gap-4"
        }
      >
        <Field
          label="Youngest age"
          htmlFor="minAge"
          optional
          hint="In years on the day. Blank for no lower limit."
        >
          <Input
            id="minAge"
            name="minAge"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            defaultValue={session?.minAge ?? ""}
          />
        </Field>
        <Field
          label="Oldest age"
          htmlFor="maxAge"
          optional
          hint="Included. Blank for no upper limit."
        >
          <Input
            id="maxAge"
            name="maxAge"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            defaultValue={session?.maxAge ?? ""}
          />
        </Field>
      </div>

      <Field label="Assessor" htmlFor="instructorId">
        <Select
          id="instructorId"
          name="instructorId"
          defaultValue={session?.instructorId ?? NONE}
          options={[
            { value: NONE, label: "Not decided yet" },
            ...instructors.map((person) => ({
              value: person.id,
              label: person.name,
            })),
          ]}
        />
      </Field>

      <Field
        label="Notes"
        htmlFor="notes"
        hint="Anything the desk should tell parents when booking."
      >
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={session?.notes ?? ""}
        />
      </Field>
    </>
  );
}

export function AddSession(props: Omit<FieldProps, "session">) {
  return (
    <FormDialog
      trigger={
        <Button variant="default" className="min-h-11">
          {<CalendarPlus aria-hidden={true} className="size-4 shrink-0" />}
          {"Add a session"}
        </Button>
      }
      title="Add an assessment session"
      description="A date, a time and a number of places. Children are booked onto it from the session's own page."
      submitLabel="Add a session"
      successMessage="Session added"
      width="sm:max-w-xl"
      submit={(formData) => createSession(readInput(formData))}
    >
      <SessionFields {...props} />
    </FormDialog>
  );
}

export function EditSession(props: FieldProps & { session: SessionRow }) {
  const { session } = props;
  return (
    <FormDialog
      trigger={
        <Button variant="outline">
          <Pencil aria-hidden={true} className="size-4 shrink-0" />
          Edit
          <span className="sr-only"> the session on {sessionLabel(session)}</span>
        </Button>
      }
      title={`Edit the session on ${sessionLabel(session)}`}
      submitLabel="Save changes"
      successMessage="Session updated"
      width="sm:max-w-xl"
      submit={(formData) => updateSession(session.id, readInput(formData))}
    >
      <SessionFields {...props} />
    </FormDialog>
  );
}

export function CancelSession({ session }: { session: SessionRow }) {
  const booked = session._count.bookings;
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline">
          <Ban aria-hidden={true} className="size-4 shrink-0" />
          Cancel session
          <span className="sr-only"> on {sessionLabel(session)}</span>
        </Button>
      }
      title={`Cancel the session on ${sessionLabel(session)}?`}
      description={
        booked > 0
          ? `${booked} ${booked === 1 ? "child is" : "children are"} booked onto it. Their bookings are cancelled with it, and the desk will need to tell the families. Anyone already assessed and placed keeps that.`
          : "Nobody is booked onto it. It stays on the record as cancelled rather than disappearing."
      }
      confirmLabel="Cancel session"
      successMessage="Session cancelled"
      destructive
      run={() => cancelSession(session.id)}
    />
  );
}
