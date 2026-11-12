import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleStart } from "@/components/workspace/module-start";
import { pageSession } from "@/lib/page-guards";
import { hrAccess, hrPages } from "@/modules/hr/features/workspace";

export const metadata: Metadata = { title: "HR" };

/** HR's starter page: counts and the way in, no records, so no step-up here; each records
 *  page still asks for a recent password. The layout has already checked HR access. */
export default async function HrOverviewPage() {
  const who = hrAccess(await pageSession());
  if (!who) notFound();
  return <ModuleStart id="hr" groups={[{ label: "", links: hrPages(who) }]} />;
}
