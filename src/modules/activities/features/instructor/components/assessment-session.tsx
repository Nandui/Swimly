import { StickyNote } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { formatShortDay } from "@/lib/format";
import { MarkNoShow, RecordOutcome } from "@/modules/activities/shared/assessments/components/booking-actions";
import { BOOKING_STATUS_META, HOLDS_A_PLACE, sessionSpan } from "@/modules/activities/shared/assessments/constants";
import type { BookingRow, SessionDetail } from "@/modules/activities/shared/assessments/data/assessments";
import { ageLabel, fullName } from "@/modules/activities/shared/students/constants";

export function InstructorAssessmentSession({ session, backHref }: { session: SessionDetail; backHref: string }) {
  const booked = session.bookings.filter(booking => HOLDS_A_PLACE.includes(booking.status));
  const notComing = session.bookings.filter(booking => !HOLDS_A_PLACE.includes(booking.status));
  const placed = booked.filter(booking => booking.outcomeLevel).length;
  // "Swim School Assessment" is the club's own name for an untyped session (PRODUCT.md).
  const title = session.type?.name ?? "Swim School Assessment";
  const facts = [
    formatShortDay(session.date),
    sessionSpan(session),
    session.club.name,
    session.location || "Pool",
    session.programme.name,
    session.instructor?.name ?? "Assessor not assigned",
    `${booked.length} booked`,
    `${placed} placed`,
  ].join(" · ");
  return (
    <>
      <PageHeader back={{ href: backHref, label: "Classes" }} title={<span className="break-words">{title}</span>} description={facts} />
      {session.notes ? (
        <p className="pc-note whitespace-pre-wrap break-words">
          <StickyNote aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span><span className="sr-only">Session notes: </span>{session.notes}</span>
        </p>
      ) : null}
      <section aria-labelledby="assessment-booked" className="pc-panel">
        <div className="pc-panel-head"><h2 id="assessment-booked">Booked swimmers</h2></div>
        {booked.length ? <AssessmentBookings bookings={booked} session={session} /> : <EmptyState compact title="No swimmers booked" hint="Nobody is booked on this assessment yet." />}
      </section>
      {notComing.length ? (
        <section aria-labelledby="assessment-not-coming" className="pc-panel">
          <div className="pc-panel-head"><h2 id="assessment-not-coming">Not coming</h2></div>
          <AssessmentBookings bookings={notComing} session={session} />
        </section>
      ) : null}
    </>
  );
}

function AssessmentBookings({ bookings, session }: { bookings: BookingRow[]; session: SessionDetail }) {
  return <ul className="pc-rows">{bookings.map(booking => {
    const meta = BOOKING_STATUS_META[booking.status];
    const about = [
      booking.student.dateOfBirth ? `Age ${ageLabel(booking.student.dateOfBirth)}` : "Age not recorded",
      booking.student.medicalNotes ? `Medical notes: ${booking.student.medicalNotes}` : null,
    ].filter(Boolean).join(" · ");
    return <li key={booking.id} className="pc-row">
      <div className="pc-row-body gap-0.5">
        <div className="flex flex-wrap items-center gap-2"><h3 className="pc-row-title break-words">{fullName(booking.student)}</h3><Tag meta={meta} /></div>
        <p className="pc-row-hint whitespace-pre-wrap break-words">{about}</p>
        {booking.outcomeLevel ? <p className="pc-row-hint">Placed at <span className="font-semibold">{booking.outcomeLevel.name}</span>{booking.assessedByName ? ` · ${booking.assessedByName}` : ""}</p> : null}
        {booking.outcomeNote ? <p className="pc-row-hint whitespace-pre-wrap break-words">{booking.outcomeNote}</p> : null}
      </div>
      <div className="pc-row-trail">
        {booking.status === "BOOKED" || booking.status === "ATTENDED" ? <RecordOutcome booking={booking} session={session} /> : null}
        {booking.status === "BOOKED" ? <MarkNoShow booking={booking} /> : null}
      </div>
    </li>;
  })}</ul>;
}
