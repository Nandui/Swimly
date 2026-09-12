import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SwimmerProfile } from "@/components/students/swimmer-profile";
import { can, canSee } from "@/lib/authz";
import { screenPage } from "@/lib/page-guards";
import { getStudent } from "@/lib/students/data/students";
import { getStudentProgress } from "@/lib/progression/data/progress";
import { getEnrolmentsForStudent, getTransferTargets } from "@/lib/enrolment/data/enrolments";
import { getStudentAssessments } from "@/lib/assessments/data/assessments";
import { getSwimmerHistory } from "@/lib/students/data/history";
import { swimmerReturnHref } from "@/lib/students/directory";

export const metadata: Metadata = { title: "Swimmer journey" };

export default async function StudentPage(props: PageProps<"/students/[id]">) {
  const session = await screenPage("students");
  const [{ id }, params] = await Promise.all([props.params, props.searchParams]);
  const access = { edit: can(session, "students.manage"), enrol: can(session, "enrolment.manage"), assess: can(session, "progression.assess"),
    complete: can(session, "progression.complete"), override: can(session, "progression.override"), courses: canSee(session, "courses"), assessments: canSee(session, "assessments"), audit: can(session, "activity.view") };
  const [student, enrolments, programmes, assessments, targets, history] = await Promise.all([
    getStudent(id), getEnrolmentsForStudent(id), getStudentProgress(id), getStudentAssessments(id), access.enrol ? getTransferTargets() : Promise.resolve([]), getSwimmerHistory(id),
  ]);
  if (!student) notFound();
  return <SwimmerProfile key={id} student={student} enrolments={enrolments} programmes={programmes} assessments={assessments} targets={targets}
    history={history} access={access} initialTab={typeof params.tab === "string" ? params.tab : undefined} returnTo={swimmerReturnHref(params.returnTo)} instant={new Date().toISOString()} />;
}
