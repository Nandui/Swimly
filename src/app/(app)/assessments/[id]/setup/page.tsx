import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssessmentNav } from "@/components/assessments/assessment-nav";
import { CancelSession, EditSession } from "@/components/assessments/session-actions";
import { WrongClub } from "@/components/clubs/wrong-club";
import { AssessmentPublicationPanel } from "@/components/parents/assessment-publication";
import { Button } from "@/components/shadcn/button";
import { BackLink } from "@/components/ui-kit/back-link";
import { PageHeader } from "@/components/ui-kit/page-header";
import { getAssessmentProgrammeOptions, getAssessmentSession, getAssessmentTypeOptions } from "@/lib/assessments/data/assessments";
import { sessionDay, sessionSpan } from "@/lib/assessments/constants";
import { getCurrentClub } from "@/lib/clubs/current";
import { getInstructorOptions } from "@/lib/courses/data/courses";
import { today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { dublinInstant } from "@/lib/parent/time";

export const metadata: Metadata = { title: "Session setup" };

export default async function SessionSetupPage({ params }: PageProps<"/assessments/[id]/setup">) {
  await screenPage("assessments", "courses.manage");
  const { id } = await params;
  const [session, { club }] = await Promise.all([getAssessmentSession(id), getCurrentClub()]);
  if (!session) notFound();
  if (session.clubId !== club.id) return <WrongClub what="This assessment session" owner={session.club} current={club} />;
  const [programmes, types, instructors] = await Promise.all([getAssessmentProgrammeOptions(), getAssessmentTypeOptions(), getInstructorOptions()]);
  return <div className="min-w-0 space-y-6">
    <BackLink href="/assessments/setup" current="Session setup">Assessment setup</BackLink>
    <PageHeader title={sessionDay(session)} description={`${sessionSpan(session)} · ${session.programme.name} · ${session.type?.name ?? "Kind not set"}`}
      actions={<Button asChild variant="outline" className="min-h-11"><Link href={`/assessments/${id}`}>View swimmers</Link></Button>} />
    <AssessmentNav active="setup" manage />
    <section aria-labelledby="session-details-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="session-details-heading" className="text-xl font-semibold">Session details</h2>
        {!session.cancelledAt ? <div className="flex items-center gap-2"><EditSession session={session} programmes={programmes} types={types} instructors={instructors} today={today()} variant="button" /><CancelSession session={session} /></div> : <p className="text-sm text-ui-muted-foreground">This session is cancelled.</p>}
      </div>
      <dl className="grid gap-4 rounded-ui-lg border border-ui-border p-4 text-sm sm:grid-cols-3">
        <div><dt className="text-ui-muted-foreground">Pool area</dt><dd className="mt-1 font-medium">{session.location || "Not set"}</dd></div>
        <div><dt className="text-ui-muted-foreground">Assessor</dt><dd className="mt-1 font-medium">{session.instructor?.name ?? "Not assigned"}</dd></div>
        <div><dt className="text-ui-muted-foreground">Places</dt><dd className="mt-1 font-medium">{session._count.bookings} booked · {session.capacity === null ? "No limit" : `${session.capacity} total`}</dd></div>
      </dl>
      {session.notes ? <p className="text-sm text-ui-muted-foreground">{session.notes}</p> : null}
    </section>
    <AssessmentPublicationPanel key={`${id}-${session.date.toISOString()}-${session.startMinutes}-${session.cancelledAt}-${session.capacity}-${session.programmeId}-${session.typeId}`}
      sessionId={id} sessionLabel={`${sessionDay(session)} · ${sessionSpan(session)} · ${session.club.name} · ${session.programme.name}`}
      startsAt={(dublinInstant(session.date.toISOString().slice(0, 10), session.startMinutes) ?? session.date).toISOString()} />
  </div>;
}
