import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { qualificationsPages } from "@/modules/qualifications/features/workspace";

export const metadata: Metadata = { title: "Qualifications" };

/** Qualifications' starter page. The layout has already checked access. */
export default function QualificationsOverviewPage() {
  return <ModuleStart id="qualifications" groups={[{ label: "", links: qualificationsPages() }]} />;
}
