import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { planPages } from "@/modules/plan/features/workspace";

export const metadata: Metadata = { title: "Plan (test)" };

/** Plan (test)'s starter page. The layout has already checked access. */
export default function PlanOverviewPage() {
  return <ModuleStart id="plan" groups={[{ label: "", links: planPages() }]} />;
}
