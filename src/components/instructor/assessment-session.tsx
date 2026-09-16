import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Item, ItemContent, ItemGroup } from "@/components/shadcn/item";
import { Tag } from "@/components/ui-kit/tag";
import { MarkNoShow, RecordOutcome } from "@/components/assessments/booking-actions";
import { BOOKING_STATUS_META, HOLDS_A_PLACE, sessionDay, sessionSpan } from "@/lib/assessments/constants";
import type { BookingRow, SessionDetail } from "@/lib/assessments/data/assessments";
import { ageLabel, fullName } from "@/lib/students/constants";

export function InstructorAssessmentSession({ session, backHref }: { session: SessionDetail; backHref: string }) {
  const booked = session.bookings.filter(booking => HOLDS_A_PLACE.includes(booking.status));
  const notComing = session.bookings.filter(booking => !HOLDS_A_PLACE.includes(booking.status));
  const placed = booked.filter(booking => booking.outcomeLevel).length;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="space-y-3">
        <Button asChild variant="ghost" className="-ml-3"><Link href={backHref}><ChevronLeft aria-hidden="true" />Back to Instructor</Link></Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold break-words">{session.type?.name ?? "Swim School Assessment"}</h1>
          <p className="text-sm text-ui-muted-foreground">{sessionDay(session)} · {sessionSpan(session)}</p>
          <p className="text-sm text-ui-muted-foreground break-words">{session.club.name} · {session.location || "Pool"} · {session.programme.name}</p>
          <p className="text-sm text-ui-muted-foreground">{session.instructor?.name ?? "Assessor not assigned"} · {booked.length} booked · {placed} placed</p>
        </div>
        {session.notes ? <p className="text-sm whitespace-pre-wrap break-words">{session.notes}</p> : null}
      </header>
      <section aria-labelledby="assessment-booked" className="space-y-3">
        <h2 id="assessment-booked" className="text-xl font-semibold">Booked swimmers</h2>
        {booked.length ? <AssessmentBookings bookings={booked} session={session} /> : <p className="text-sm text-ui-muted-foreground">No swimmers are booked on this assessment.</p>}
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
        <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold break-words">{fullName(booking.student)}</h3><Tag color={meta.color}>{meta.label}</Tag></div>
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
