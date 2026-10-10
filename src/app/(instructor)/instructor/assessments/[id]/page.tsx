import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InstructorAssessmentSession, instructorHomeHref } from "@/modules/activities/features/instructor";
import { getInstructorAssessmentSession } from "@/modules/activities/features/assessments";

export const metadata: Metadata = { title: "Assessment" };

export default async function InstructorAssessmentPage(props: PageProps<"/instructor/assessments/[id]">) {
  const [params, query] = await Promise.all([props.params, props.searchParams]);
  const session = await getInstructorAssessmentSession(params.id);
  if (!session) notFound();
  return <InstructorAssessmentSession session={session} backHref={instructorHomeHref(query)} />;
}
