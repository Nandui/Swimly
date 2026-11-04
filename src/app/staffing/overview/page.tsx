import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { staffingPages } from "@/modules/staffing/features/workspace";

export const metadata: Metadata = { title: "Staffing" };

/** Staffing's starter page. The layout has already checked access. */
export default function StaffingOverviewPage() {
  return <ModuleStart id="staffing" groups={[{ label: "", links: staffingPages() }]} />;
}
