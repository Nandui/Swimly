import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { shortCoursesPages } from "@/modules/short-courses/features/workspace";

export const metadata: Metadata = { title: "Short courses" };

/** Short courses' starter page. The layout has already checked access. */
export default function ShortCoursesOverviewPage() {
  return <ModuleStart id="short-courses" groups={[{ label: "", links: shortCoursesPages() }]} />;
}
