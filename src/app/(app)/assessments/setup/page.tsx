import type { Metadata } from "next";
import { AddSession } from "@/components/assessments/session-actions";
import { SessionDirectory, sessionView } from "@/components/assessments/session-directory";
import { getAssessmentProgrammeOptions, getAssessmentSessions, getAssessmentTypeOptions } from "@/lib/assessments/data/assessments";
import { getInstructorOptions } from "@/lib/courses/data/courses";
import { today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Assessment setup" };

export default async function AssessmentSetupPage({ searchParams }: PageProps<"/assessments/setup">) {
  await screenPage("assessments", "courses.manage");
  const [sessions, programmes, types, instructors, query] = await Promise.all([
    getAssessmentSessions(), getAssessmentProgrammeOptions(), getAssessmentTypeOptions(), getInstructorOptions(), searchParams,
  ]);
  return <SessionDirectory setup manage sessions={sessions} today={today()} view={sessionView(query.view, true)}
    createAction={<AddSession programmes={programmes} types={types} instructors={instructors} today={today()} />} />;
}
