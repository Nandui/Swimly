import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleStart } from "@/components/workspace/module-start";
import { pageSession } from "@/lib/page-guards";
import { purchasingAccess, purchasingPages } from "@/modules/purchasing/features/workspace";

export const metadata: Metadata = { title: "Purchasing" };

/** Purchasing's starter page. The layout has already checked Purchasing access. */
export default async function PurchasingOverviewPage() {
  const who = purchasingAccess(await pageSession());
  if (!who) notFound();
  return <ModuleStart id="purchasing" groups={[{ label: "", links: purchasingPages(who) }]} />;
}
