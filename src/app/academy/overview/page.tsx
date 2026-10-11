import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { academyPages } from "@/modules/academy/features/workspace";

export const metadata: Metadata = { title: "Academy" };

/** The Academy's starter page. The layout has already checked Academy access. */
export default function AcademyOverviewPage() {
  return <ModuleStart id="academy" groups={[{ label: "", links: academyPages() }]} />;
}
