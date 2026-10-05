import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelSession, EditSession } from "@/modules/activities/components/assessments/session-actions";
import { WrongClub } from "@/components/clubs/wrong-club";
import { AssessmentPublicationPanel } from "@/modules/activities/components/parents/assessment-publication";
import { Button } from "@/components/shadcn/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { getAssessmentProgrammeOptions, getAssessmentSession, getAssessmentTypeOptions } from "@/modules/activities/lib/assessments/data/assessments";
import { sessionDay, sessionSpan } from "@/modules/activities/lib/assessments/constants";
import { getCurrentClub } from "@/lib/clubs/current";
import { getInstructorOptions } from "@/modules/activities/lib/courses/data/courses";
import { today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { dublinInstant } from "@/modules/activities/lib/parent/time";

export const metadata: Metadata = { title: "Session setup" };

export default async function SessionSetupPage({ params }: PageProps<"/assessments/[id]/setup">) {
  await screenPage("assessments", "courses.manage");
  const { id } = await params;
  const [session, { club }] = await Promise.all([getAssessmentSession(id), getCurrentClub()]);
  if (!session) notFound();
  if (session.clubId !== club.id) return <WrongClub what="This assessment session" owner={session.club} current={club} />;
  const [programmes, types, instructors] = await Promise.all([getAssessmentProgrammeOptions(), getAssessmentTypeOptions(), getInstructorOptions()]);
  return <div className="min-w-0 flex flex-col gap-6">
    <PageHeader back={{ href: "/assessments/setup", label: "Assessment setup" }} title={sessionDay(session)} description={`${sessionSpan(session)} · ${session.programme.name} · ${session.type?.name ?? "Kind not set"}`}
      actions={<Button asChild variant="outline"><Link href={`/assessments/${id}`}>View swimmers</Link></Button>} />
    <section aria-labelledby="session-details-heading" className="pc-panel">
      <div className="pc-panel-head">
        <h2 id="session-details-heading">Session details</h2>
        {!session.cancelledAt ? <div className="flex flex-wrap items-center gap-2"><CancelSession session={session} /><EditSession session={session} programmes={programmes} types={types} instructors={instructors} today={today()} /></div> : <p className="text-sm text-ui-muted-foreground">This session is cancelled.</p>}
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="pc-stat"><dt className="text-xs text-ui-muted-foreground">Pool area</dt><dd className="text-sm font-semibold">{session.location || "Not set"}</dd></div>
        <div className="pc-stat"><dt className="text-xs text-ui-muted-foreground">Assessor</dt><dd className="text-sm font-semibold">{session.instructor?.name ?? "Not assigned"}</dd></div>
        <div className="pc-stat"><dt className="text-xs text-ui-muted-foreground">Places</dt><dd className="text-sm font-semibold">{session._count.bookings} booked · {session.capacity === null ? "No limit" : `${session.capacity} total`}</dd></div>
      </dl>
      {session.notes ? <p className="text-sm text-ui-muted-foreground">{session.notes}</p> : null}
    </section>
    <AssessmentPublicationPanel key={`${id}-${session.date.toISOString()}-${session.startMinutes}-${session.cancelledAt}-${session.capacity}-${session.programmeId}-${session.typeId}`}
      sessionId={id} sessionLabel={`${sessionDay(session)} · ${sessionSpan(session)} · ${session.club.name} · ${session.programme.name}`}
      startsAt={(dublinInstant(session.date.toISOString().slice(0, 10), session.startMinutes) ?? session.date).toISOString()} />
  </div>;
}
