import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InstructorAssessmentSession } from "@/components/instructor/assessment-session";
import { getInstructorAssessmentSession } from "@/lib/assessments/data/instructor";
import { instructorHomeHref } from "@/lib/attendance/navigation";

export const metadata: Metadata = { title: "Assessment" };

export default async function InstructorAssessmentPage(props: PageProps<"/instructor/assessments/[id]">) {
  const [params, query] = await Promise.all([props.params, props.searchParams]);
  const session = await getInstructorAssessmentSession(params.id);
  if (!session) notFound();
  return <InstructorAssessmentSession session={session} backHref={instructorHomeHref(query)} />;
}
