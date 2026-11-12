import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleStart } from "@/components/workspace/module-start";
import { financeActor, financePages } from "@/modules/finance-requests/features/workspace";

export const metadata: Metadata = { title: "Finance requests" };

/** Finance requests' starter page. The layout has already checked access. */
export default async function FinanceRequestsOverviewPage() {
  const who = await financeActor();
  if (!who) notFound();
  return <ModuleStart id="finance-requests" groups={[{ label: "", links: financePages(who) }]} />;
}
