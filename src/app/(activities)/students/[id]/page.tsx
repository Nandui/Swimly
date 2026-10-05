import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SwimmerProfile } from "@/modules/activities/components/students/swimmer-profile";
import { can, canSee } from "@/lib/authz";
import { screenPage } from "@/lib/page-guards";
import { getStudent } from "@/modules/activities/lib/students/data/students";
import { getStudentProgress } from "@/modules/activities/lib/progression/data/progress";
import { getEnrolmentsForStudent, getTransferTargets } from "@/modules/activities/lib/enrolment/data/enrolments";
import { getStudentAssessments } from "@/modules/activities/lib/assessments/data/assessments";
import { getSwimmerHistory } from "@/modules/activities/lib/students/data/history";
import { swimmerReturnHref } from "@/modules/activities/lib/students/directory";

/** Never the child's name: tab titles persist in browser history on shared
 *  reception and poolside devices, which the idle sign-out cannot clear. */
export const metadata: Metadata = { title: "Swimmer" };

export default async function StudentPage(props: PageProps<"/students/[id]">) {
  const session = await screenPage("students");
  const [{ id }, params] = await Promise.all([props.params, props.searchParams]);
  const access = { edit: can(session, "students.manage"), enrol: can(session, "enrolment.manage"), assess: can(session, "progression.assess"),
    complete: can(session, "progression.complete"), override: can(session, "progression.override"), courses: canSee(session, "courses"), assessments: canSee(session, "assessments"), audit: can(session, "activity.view"), parents: can(session, "parents.manage") };
  const [student, enrolments, programmes, assessments, targets, history] = await Promise.all([
    getStudent(id), getEnrolmentsForStudent(id), getStudentProgress(id), getStudentAssessments(id), access.enrol ? getTransferTargets() : Promise.resolve([]), getSwimmerHistory(id),
  ]);
  if (!student) notFound();
  return <SwimmerProfile key={id} student={student} enrolments={enrolments} programmes={programmes} assessments={assessments} targets={targets}
    history={history} access={access} initialTab={typeof params.tab === "string" ? params.tab : undefined} returnTo={swimmerReturnHref(params.returnTo)} instant={new Date().toISOString()} />;
}
