import type { Metadata } from "next";
import { HighRiskList, highRiskHazards } from "@/modules/risk/features/hazards";

export const metadata: Metadata = { title: "High risk hazards" };

export default async function RiskHighPage({ searchParams }: PageProps<"/risk-assessments/high-risk">) {
  const raw = await searchParams;
  const one = (key: string) => (typeof raw[key] === "string" ? raw[key] as string : undefined);
  return <HighRiskList data={await highRiskHazards({ site: one("site"), page: one("page") })} />;
}
