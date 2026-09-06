"use client";

import { GraduationCap, UserRoundPlus, UserRoundX, X } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { StudentPicker } from "@/components/students/student-search";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  bookStudent,
  cancelBooking,
  markNoShow,
  recordOutcome,
} from "@/lib/assessments/actions/bookings";
import { sessionLabel } from "@/lib/assessments/constants";
import type { BookingRow, SessionDetail } from "@/lib/assessments/data/assessments";
import { fullName } from "@/lib/students/constants";

export function BookOntoSession({ session, taken }: { session: SessionDetail; taken: number }) {
  const places =
    session.capacity === null ? "no limit on places" : `${taken} of ${session.capacity} places taken`;
  return (
    <FormDialog
      trigger={
        <Button label="Book a swimmer" variant="primary" size="sm" icon={<UserRoundPlus className="size-4" aria-hidden />} />
      }
      title={`Book onto the assessment on ${sessionLabel(session)}`}
      description={`${session.programme.name} · ${places}`}
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

export function CancelBooking({ booking, session }: { booking: BookingRow; session: SessionDetail }) {
  return (
    <ConfirmAction
      trigger={
        <IconButton label={`Cancel ${fullName(booking.student)}'s booking`} variant="ghost" size="sm" icon={<X className="size-4" aria-hidden />} />
      }
      title={`Cancel ${fullName(booking.student)}'s booking?`}
      description={`They lose their place on ${sessionLabel(session)}. They can be booked again while there is room.`}
      confirmLabel="Cancel booking"
      successMessage="Booking cancelled"
      run={() => cancelBooking(booking.id)}
    />
  );
}

export function MarkNoShow({ booking }: { booking: BookingRow }) {
  return (
    <ConfirmAction
      trigger={
        <IconButton label={`${fullName(booking.student)} did not come`} variant="ghost" size="sm" icon={<UserRoundX className="size-4" aria-hidden />} tooltip="Did not come" />
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
  variant = "icon",
}: {
  booking: BookingRow;
  session: SessionDetail;
  variant?: "icon" | "button";
}) {
  const name = fullName(booking.student);
  const again = Boolean(booking.outcomeLevel);
  return (
    <FormDialog
      trigger={
        variant === "icon" ? (
          <IconButton label={again ? `Change where ${name} was placed` : `Place ${name}`} variant="ghost" size="sm" icon={<GraduationCap className="size-4" aria-hidden />} />
        ) : (
          <Button label={`${again ? "Change placement" : "Place"}`} variant={again ? "secondary" : "primary"} size="sm" icon={<GraduationCap className="size-4" aria-hidden />} />
        )
      }
      title={again ? `Change where ${name} belongs` : `Where does ${name} belong?`}
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
          options={session.programme.levels.map((level) => ({ value: level.id, label: level.name }))}
        />
      </Field>
      <Field label="Note" htmlFor="note" hint="What you saw. It goes on their record.">
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
