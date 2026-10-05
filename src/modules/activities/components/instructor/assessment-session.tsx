import { EmptyState } from "@/components/ui-kit/empty-state";
import { BackLink } from "@/components/ui-kit/back-link";
import { Item, ItemContent, ItemGroup } from "@/components/shadcn/item";
import { Tag } from "@/components/ui-kit/tag";
import { MarkNoShow, RecordOutcome } from "@/modules/activities/components/assessments/booking-actions";
import { BOOKING_STATUS_META, HOLDS_A_PLACE, sessionDay, sessionSpan } from "@/modules/activities/lib/assessments/constants";
import type { BookingRow, SessionDetail } from "@/modules/activities/lib/assessments/data/assessments";
import { ageLabel, fullName } from "@/modules/activities/lib/students/constants";

export function InstructorAssessmentSession({ session, backHref }: { session: SessionDetail; backHref: string }) {
  const booked = session.bookings.filter(booking => HOLDS_A_PLACE.includes(booking.status));
  const notComing = session.bookings.filter(booking => !HOLDS_A_PLACE.includes(booking.status));
  const placed = booked.filter(booking => booking.outcomeLevel).length;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <BackLink href={backHref} label="Instructor" />
        <div className="space-y-1">
          <h1 className="break-words">{session.type?.name ?? "Swim school assessment"}</h1>
          <p className="text-sm text-ui-muted-foreground">{sessionDay(session)} · {sessionSpan(session)}</p>
          <p className="text-sm text-ui-muted-foreground break-words">{session.club.name} · {session.location || "Pool"} · {session.programme.name}</p>
          <p className="text-sm text-ui-muted-foreground">{session.instructor?.name ?? "Assessor not assigned"} · {booked.length} booked · {placed} placed</p>
        </div>
        {session.notes ? <p className="mt-2 text-sm whitespace-pre-wrap break-words">{session.notes}</p> : null}
      </header>
      <section aria-labelledby="assessment-booked" className="space-y-3">
        <h2 id="assessment-booked" className="text-xl font-semibold">Booked swimmers</h2>
        {booked.length ? <AssessmentBookings bookings={booked} session={session} /> : <EmptyState compact title="No swimmers are booked on this assessment." />}
      </section>
      {notComing.length ? <section aria-labelledby="assessment-not-coming" className="space-y-3">
        <h2 id="assessment-not-coming" className="text-xl font-semibold">Not coming</h2>
        <AssessmentBookings bookings={notComing} session={session} />
      </section> : null}
    </div>
  );
}

function AssessmentBookings({ bookings, session }: { bookings: BookingRow[]; session: SessionDetail }) {
  return <ItemGroup className="divide-y divide-ui-border">{bookings.map(booking => {
    const meta = BOOKING_STATUS_META[booking.status];
    return <Item key={booking.id} role="listitem" className="items-start rounded-none px-0 py-5">
      <ItemContent className="min-w-0 basis-56 space-y-2">
        <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold break-words">{fullName(booking.student)}</h3><Tag meta={meta} /></div>
        <p className="text-sm text-ui-muted-foreground">{booking.student.dateOfBirth ? `Age: ${ageLabel(booking.student.dateOfBirth)}` : "Age not recorded"}</p>
        {booking.student.medicalNotes ? <p className="text-sm whitespace-pre-wrap break-words"><span className="font-medium">Medical notes: </span>{booking.student.medicalNotes}</p> : null}
        {booking.outcomeLevel ? <p className="text-sm">Placed at <span className="font-medium">{booking.outcomeLevel.name}</span>{booking.assessedByName ? ` · ${booking.assessedByName}` : ""}</p> : null}
        {booking.outcomeNote ? <p className="text-sm text-ui-muted-foreground whitespace-pre-wrap break-words">{booking.outcomeNote}</p> : null}
      </ItemContent>
      <div className="flex flex-wrap items-center gap-2">
        {booking.status === "BOOKED" || booking.status === "ATTENDED" ? <RecordOutcome booking={booking} session={session} variant="button" /> : null}
        {booking.status === "BOOKED" ? <MarkNoShow booking={booking} variant="button" /> : null}
      </div>
    </Item>;
  })}</ItemGroup>;
}
