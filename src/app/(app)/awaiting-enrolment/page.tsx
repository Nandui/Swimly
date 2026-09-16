import type { Metadata } from "next";
import { AwaitingEnrolment } from "@/components/enrolment/awaiting-enrolment";
import { getAwaitingEnrolment } from "@/lib/enrolment/data/awaiting-enrolment";
import { can, canSee } from "@/lib/authz";
import { getTransferTargets } from "@/lib/enrolment/data/enrolments";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Awaiting enrolment" };

export default async function AwaitingEnrolmentPage({ searchParams }: PageProps<"/awaiting-enrolment">) {
  const actor = await screenPage("awaiting-enrolment");
  const query = await searchParams;
  const enrol = can(actor, "enrolment.manage");
  const [result, courses] = await Promise.all([
    getAwaitingEnrolment({ q: typeof query.q === "string" ? query.q : "", page: typeof query.page === "string" ? Number(query.page) : 1 }),
    enrol ? getTransferTargets() : Promise.resolve([]),
  ]);
  return <AwaitingEnrolment result={result} courses={courses} enrol={enrol} profiles={canSee(actor, "students")} assessments={canSee(actor, "assessments")} />;
}
