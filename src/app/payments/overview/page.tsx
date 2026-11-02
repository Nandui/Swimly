import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { paymentsPages, requirePaymentsActor } from "@/modules/payments/features/workspace";

export const metadata: Metadata = { title: "Payments" };

/** Payments' starter page. The layout has already checked Payments access. */
export default async function PaymentsOverviewPage() {
  return <ModuleStart id="payments" groups={[{ label: "", links: paymentsPages(await requirePaymentsActor()) }]} />;
}
