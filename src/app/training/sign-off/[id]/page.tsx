import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { formatDateTime } from "@/lib/format";
import { observationFor, ObservePractical } from "@/modules/training/features/sign-off";

export const metadata: Metadata = { title: "Observe a practical" };

/** The poolside sign-off (e-learning phase 5): a trainer watches someone do
 *  the practical and marks each step of the course's checklist on a tablet. */
export default async function ObservePage({ params }: { params: Promise<{ id: string }> }) {
  const data = await observationFor((await params).id);
  if (!data || !data.who.signoff) notFound();
  const { person, own, assignment, course, checklist, last, evidence } = data;
  const waiting = assignment.status === "SUBMITTED";
  return (
    <PageShell spacing="roomy" header={<PageHeader back={{ href: "/training/sign-off", label: "Sign-off" }} title={`${course.title}: ${person.name}`}
        description={waiting ? `Ready since ${assignment.submittedAt ? formatDateTime(assignment.submittedAt) : "—"}. Watch them do each step, then sign off or send it back.` : "This practical is not waiting for sign-off."} />}>
      {assignment.learnerNote ? <Notice tone="info" title={`${person.name}'s note`}>{assignment.learnerNote}</Notice> : null}
      {own ? (
        <EmptyState as="h2" icon="clipboardCheck" title="This is your own training" hint="Someone else has to sign it off." />
      ) : !waiting ? (
        <EmptyState as="h2" icon="clipboardCheck" title="Nothing to observe" hint="It has been signed off or sent back already, or was never asked for." />
      ) : !checklist.length ? (
        <EmptyState as="h2" icon="clipboardCheck" title="This course has no checklist" hint="Sign it off from the Sign-off page." />
      ) : (
        <ObservePractical id={assignment.id} name={person.name} title={course.title} steps={checklist} evidence={evidence} last={last?.steps ?? null} />
      )}
    </PageShell>
  );
}
