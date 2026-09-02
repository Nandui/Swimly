"use client";

import { GraduationCap, UserRoundPlus, UserRoundX, X } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { StudentPicker } from "@/components/students/student-search";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        <Button size="sm">
          <UserRoundPlus className="size-4" />
          Book a swimmer
        </Button>
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
        hint="Not on the books yet? Add them under Students first, then come back here."
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
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Cancel ${fullName(booking.student)}'s booking`}
        >
          <X className="size-3.5" />
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

export function MarkNoShow({ booking }: { booking: BookingRow }) {
  return (
    <ConfirmAction
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${fullName(booking.student)} did not come`}
          title="Did not come"
        >
          <UserRoundX className="size-3.5" />
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
          <Button variant="ghost" size="icon-sm" aria-label={again ? `Change where ${name} was placed` : `Place ${name}`}>
            <GraduationCap className="size-3.5" />
          </Button>
        ) : (
          <Button size="sm" variant={again ? "outline" : "default"}>
            <GraduationCap className="size-4" />
            {again ? "Change placement" : "Place"}
          </Button>
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
        <Select name="levelId" defaultValue={booking.outcomeLevel?.id}>
          <SelectTrigger id="levelId" className="w-full">
            <SelectValue placeholder="Pick a level" />
          </SelectTrigger>
          <SelectContent>
            {session.programme.levels.map((level) => (
              <SelectItem key={level.id} value={level.id}>
                {level.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
