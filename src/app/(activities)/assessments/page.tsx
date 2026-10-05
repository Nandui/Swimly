import type { Metadata } from "next";
import { SessionDirectory, sessionView } from "@/modules/activities/components/assessments/session-directory";
import { getAssessmentSessions } from "@/modules/activities/lib/assessments/data/assessments";
import { can } from "@/lib/authz";
import { today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";

export async function generateMetadata({ searchParams }: PageProps<"/assessments">): Promise<Metadata> {
  return { title: sessionView((await searchParams).view) === "past" ? "Past assessments" : "Upcoming assessments" };
}

export default async function AssessmentsPage({ searchParams }: PageProps<"/assessments">) {
  const actor = await screenPage("assessments");
  const [sessions, query] = await Promise.all([getAssessmentSessions(), searchParams]);
  return <SessionDirectory sessions={sessions} today={today()} manage={can(actor, "courses.manage")} view={sessionView(query.view)} />;
}
