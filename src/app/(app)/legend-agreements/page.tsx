import type { Metadata } from "next";
import { LegendAgreements } from "@/components/enrolment/legend-agreements";
import { getLegendAgreements } from "@/lib/enrolment/data/legend-agreements";
import { can, canSee } from "@/lib/authz";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Legend agreements" };
export default async function LegendAgreementsPage({ searchParams }: PageProps<"/legend-agreements">) {
  const actor = await screenPage("legend-agreements");
  const query = await searchParams;
  const result = await getLegendAgreements({ q: typeof query.q === "string" ? query.q : "", view: typeof query.view === "string" ? query.view : "", page: typeof query.page === "string" ? Number(query.page) : 1 });
  return <LegendAgreements result={result} canConfirm={can(actor, "enrolment.manage")} profiles={canSee(actor, "students")} classes={canSee(actor, "courses")} />;
}
