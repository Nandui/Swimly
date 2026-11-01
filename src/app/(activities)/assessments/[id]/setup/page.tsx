import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ageRangeLabel, CancelSession, dublinInstant, EditSession, getAssessmentProgrammeOptions, getAssessmentSession, getAssessmentTypeOptions, getInstructorOptions, sessionDay, sessionSpan,
} from "@/modules/activities/features/assessments";
import { WrongClub } from "@/components/ui/wrong-club";
import { AssessmentPublicationPanel } from "@/modules/activities/features/parents";
import { Button } from "@/components/shadcn/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordFacts, RecordSection } from "@/components/ui-kit/record";
import { getCurrentClub } from "@/lib/clubs/current";
import { today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Session setup" };

export default async function SessionSetupPage({ params }: PageProps<"/assessments/[id]/setup">) {
  await screenPage("assessments", "courses.manage");
  const { id } = await params;
  const [session, { club }] = await Promise.all([getAssessmentSession(id), getCurrentClub()]);
  if (!session) notFound();
  if (session.clubId !== club.id) return <WrongClub what="This assessment session" owner={session.club} current={club} />;
  const [programmes, types, instructors] = await Promise.all([getAssessmentProgrammeOptions(), getAssessmentTypeOptions(), getInstructorOptions()]);
  return <PageShell spacing="roomy" header={<PageHeader back={{ href: "/assessments/setup", label: "Assessment setup" }} title={sessionDay(session)} description={`${sessionSpan(session)} · ${session.programme.name} · ${session.type?.name ?? "Kind not set"}`}
      actions={<Button asChild variant="outline"><Link href={`/assessments/${id}`}>View swimmers</Link></Button>} />}>
    <RecordSection id="session-details-heading" title="Session details"
      aside={!session.cancelledAt ? <div className="flex flex-wrap items-center gap-2"><CancelSession session={session} /><EditSession session={session} programmes={programmes} types={types} instructors={instructors} today={today()} /></div> : <p>Cancelled</p>}>
      <div className="rec-card">
        <RecordFacts items={[
          ["Pool area", session.location || "Not set"],
          ["Assessor", session.instructor?.name ?? "Not assigned"],
          ["Places", `${session._count.bookings} booked · ${session.capacity === null ? "No limit" : `${session.capacity} total`}`],
          ["Ages", ageRangeLabel(session) ?? "Any age"],
          ...(session.notes ? [["Notes", session.notes, true] as [string, string, boolean]] : []),
        ]} />
      </div>
    </RecordSection>
    <AssessmentPublicationPanel key={`${id}-${session.date.toISOString()}-${session.startMinutes}-${session.cancelledAt}-${session.capacity}-${session.programmeId}-${session.typeId}`}
      sessionId={id} sessionLabel={`${sessionDay(session)} · ${sessionSpan(session)} · ${session.club.name} · ${session.programme.name}`}
      startsAt={(dublinInstant(session.date.toISOString().slice(0, 10), session.startMinutes) ?? session.date).toISOString()} />
  </PageShell>;
}
