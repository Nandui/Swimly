import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { requireRiskActor, riskPages } from "@/modules/risk/features/workspace";

export const metadata: Metadata = { title: "Risk assessments" };

/** The starter page of Risk assessments. The layout has already checked access. */
export default async function RiskOverviewPage() {
  const who = await requireRiskActor();
  return <ModuleStart id="risk" groups={[{ label: "", links: riskPages({ write: who.write }) }]} />;
}
