import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { cctvPages } from "@/modules/cctv/features/workspace";

export const metadata: Metadata = { title: "CCTV log" };

/** The CCTV log's starter page. The layout has already checked access. */
export default function CctvOverviewPage() {
  return <ModuleStart id="cctv" groups={[{ label: "", links: cctvPages() }]} />;
}
