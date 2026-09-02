"use client";

import * as React from "react";
import { CalendarPlus, Pencil, Ban } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelSession,
  createSession,
  updateSession,
  type SessionInput,
} from "@/lib/assessments/actions/sessions";
import { sessionLabel } from "@/lib/assessments/constants";
import type {
  AssessmentTypeOption,
  ProgrammeOption,
  SessionRow,
} from "@/lib/assessments/data/assessments";
import type { InstructorOption } from "@/lib/courses/data/courses";
import { formatTime } from "@/lib/courses/constants";
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
function SessionFields({ session, programmes, types, instructors, today }: FieldProps) {
  const [programmeId, setProgrammeId] = React.useState(
    session?.programmeId ?? programmes[0]?.id ?? ""
  );
  const kinds = types.filter((type) => type.programmeId === programmeId);
  const currentKind =
    session && session.programmeId === programmeId ? (session.typeId ?? undefined) : undefined;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Programme"
          htmlFor="programmeId"
          hint="What the assessor places children into."
        >
          <Select name="programmeId" value={programmeId} onValueChange={setProgrammeId}>
            <SelectTrigger id="programmeId" className="w-full">
              <SelectValue placeholder="Pick a programme" />
            </SelectTrigger>
            <SelectContent>
              {programmes.map((programme) => (
                <SelectItem key={programme.id} value={programme.id}>
                  {programme.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Select key={programmeId} name="typeId" defaultValue={currentKind ?? kinds[0]?.id} disabled={kinds.length === 0}>
            <SelectTrigger id="typeId" className="w-full">
              <SelectValue placeholder={kinds.length === 0 ? "None yet" : "Pick a kind"} />
            </SelectTrigger>
            <SelectContent>
              {kinds.map((kind) => (
                <SelectItem key={kind.id} value={kind.id}>
                  {kind.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
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
            required
            inputMode="numeric"
            placeholder="13:30"
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Places" htmlFor="capacity" hint="Leave blank for no limit.">
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            defaultValue={session?.capacity ?? ""}
          />
        </Field>
        <Field label="Pool" htmlFor="location">
          <Input
            id="location"
            name="location"
            placeholder="Learner Pool"
            defaultValue={session?.location ?? ""}
          />
        </Field>
      </div>

      <Field label="Assessor" htmlFor="instructorId">
        <Select name="instructorId" defaultValue={session?.instructorId ?? NONE}>
          <SelectTrigger id="instructorId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not decided yet</SelectItem>
            {instructors.map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {person.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Notes" htmlFor="notes" hint="Anything the desk should tell parents when booking.">
        <Textarea id="notes" name="notes" rows={2} defaultValue={session?.notes ?? ""} />
      </Field>
    </>
  );
}

export function AddSession(props: Omit<FieldProps, "session">) {
  return (
    <FormDialog
      trigger={
        <Button size="sm">
          <CalendarPlus className="size-4" />
          Add a session
        </Button>
      }
      title="Add an assessment session"
      description="A date, a time and a number of places. Children are booked onto it from the session's own page."
      submitLabel="Add session"
      successMessage="Session added"
      width="sm:max-w-xl"
      submit={(formData) => createSession(readInput(formData))}
    >
      <SessionFields {...props} />
    </FormDialog>
  );
}

export function EditSession({
  variant = "icon",
  ...props
}: FieldProps & { session: SessionRow; variant?: "icon" | "button" }) {
  const { session } = props;
  return (
    <FormDialog
      trigger={
        variant === "icon" ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit the session on ${sessionLabel(session)}`}>
            <Pencil className="size-3.5" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        )
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
        <Button variant="ghost" size="icon-sm" aria-label={`Cancel the session on ${sessionLabel(session)}`}>
          <Ban className="size-3.5" />
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
