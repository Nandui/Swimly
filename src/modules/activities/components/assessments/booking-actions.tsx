"use client";
import { Button } from "@/components/shadcn/button";

import { GraduationCap, UserRoundPlus, UserRoundX, X } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { StudentPicker } from "@/modules/activities/components/students/student-search";

import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  bookStudent,
  cancelBooking,
  markNoShow,
  recordOutcome,
} from "@/modules/activities/lib/assessments/actions/bookings";
import { ageRangeLabel } from "@/modules/activities/lib/assessments/age";
import { sessionLabel } from "@/modules/activities/lib/assessments/constants";
import type {
  BookingRow,
  SessionDetail,
} from "@/modules/activities/lib/assessments/data/assessments";
import { fullName } from "@/modules/activities/lib/students/constants";

export function BookOntoSession({
  session,
  taken,
}: {
  session: SessionDetail;
  taken: number;
}) {
  const places =
    session.capacity === null
      ? "no limit on places"
      : `${taken} of ${session.capacity} places taken`;
  const ages = ageRangeLabel(session);
  return (
    <FormDialog
      trigger={
        <Button variant="default">
          {<UserRoundPlus aria-hidden={true} className="size-4 shrink-0" />}
          {"Book a swimmer"}
        </Button>
      }
      title={`Book onto the assessment on ${sessionLabel(session)}`}
      description={`${session.programme.name} · ${places}${ages ? ` · ${ages.toLowerCase()}` : ""}`}
      submitLabel="Book"
      successMessage="Swimmer booked"
      submit={(formData) =>
        bookStudent({
          sessionId: session.id,
          studentId: String(formData.get("studentId") ?? ""),
        })
      }
    >
      <Field
        label="Swimmer"
        htmlFor="studentId"
        hint="Not on the books yet? Add them under Swimmers first, then come back here."
      >
        <StudentPicker id="studentId" name="studentId" />
      </Field>
    </FormDialog>
  );
}

export function CancelBooking({
  booking,
  session,
}: {
  booking: BookingRow;
  session: SessionDetail;
}) {
  return (
    <ConfirmAction
      trigger={
        <Button
          variant="outline"
          aria-label={`Cancel ${fullName(booking.student)}'s booking`}
          size="icon"
        >
          {<X aria-hidden={true} className="size-4 shrink-0" />}
        </Button>
      }
      title={`Cancel ${fullName(booking.student)}'s booking?`}
      description={`They lose their place on ${sessionLabel(session)}. They can be booked again while there is room.`}
      confirmLabel="Cancel booking"
      successMessage="Booking cancelled"
      run={() => cancelBooking(booking.id)}
    />
  );
}

/** Row actions are labelled buttons (SSAssessSession): the visible words lead
 *  the accessible name and the swimmer follows for screen readers. */
export function MarkNoShow({ booking }: { booking: BookingRow }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline">
          <UserRoundX aria-hidden={true} className="size-4 shrink-0" />
          Did not come
          <span className="sr-only">: {fullName(booking.student)}</span>
        </Button>
      }
      title={`${fullName(booking.student)} did not come?`}
      description="Their place is given back. The desk can book them onto another session."
      confirmLabel="Did not come"
      successMessage="Marked as not having come"
      run={() => markNoShow(booking.id)}
    />
  );
}

/** Where the child belongs. The list is the session's programme's levels and
 *  nothing else, because that is all an outcome is allowed to name. */
export function RecordOutcome({
  booking,
  session,
}: {
  booking: BookingRow;
  session: SessionDetail;
}) {
  const name = fullName(booking.student);
  const again = Boolean(booking.outcomeLevel);
  return (
    <FormDialog
      trigger={
        <Button variant={again ? "outline" : "default"}>
          <GraduationCap aria-hidden={true} className="size-4 shrink-0" />
          {again ? "Change placement" : "Place"}
          <span className="sr-only"> {name}</span>
        </Button>
      }
      title={
        again ? `Change where ${name} belongs` : `Where does ${name} belong?`
      }
      description={`${session.programme.name} · assessed on ${sessionLabel(session)}`}
      submitLabel={again ? "Save" : "Place"}
      successMessage={`${name} placed`}
      submit={(formData) =>
        recordOutcome({
          bookingId: booking.id,
          levelId: String(formData.get("levelId") ?? ""),
          note: String(formData.get("note") ?? ""),
        })
      }
    >
      <Field
        label="Level"
        htmlFor="levelId"
        hint="From now on they can be enrolled at this level, or any below it, without a reason being asked for."
      >
        <Select
          id="levelId"
          name="levelId"
          defaultValue={booking.outcomeLevel?.id}
          placeholder="Pick a level"
          options={session.programme.levels.map((level) => ({
            value: level.id,
            label: level.name,
          }))}
        />
      </Field>
      <Field
        label="Note"
        htmlFor="note"
        hint="What you saw. It goes on their record."
      >
        <Textarea
          id="note"
          name="note"
          rows={2}
          placeholder="Confident on front and back, not yet in the deep end"
          defaultValue={booking.outcomeNote ?? ""}
        />
      </Field>
    </FormDialog>
  );
}
