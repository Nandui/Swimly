import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { refundPages, requireRefundActor } from "@/modules/refunds/features/workspace";

export const metadata: Metadata = { title: "Refunds" };

/** Refunds' starter page. The layout has already checked Refunds access. */
export default async function RefundsOverviewPage() {
  const who = await requireRefundActor();
  return <ModuleStart id="refunds" groups={[{ label: "", links: refundPages(who) }]} />;
}
