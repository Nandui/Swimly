import type { Metadata } from "next";
import { AssessmentList, riskLists } from "@/modules/risk/features/assessments";

export const metadata: Metadata = { title: "Risk assessments" };

export default async function RiskAssessmentsPage({ searchParams }: PageProps<"/risk-assessments">) {
  const raw = await searchParams;
  const one = (key: string) => (typeof raw[key] === "string" ? raw[key] as string : undefined);
  return <AssessmentList data={await riskLists({ show: one("show"), site: one("site"), page: one("page") })} />;
}
