import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getEnrolmentsForStudent, getStudent, getStudentAssessments, getStudentProgress, getSwimmerHistory, getTransferTargets, SwimmerProfile, swimmerReturnHref,
} from "@/modules/activities/features/students";
import { can, canSee } from "@/lib/authz";
import { screenPage } from "@/lib/page-guards";

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
