import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleStart } from "@/components/workspace/module-start";
import { pageSession } from "@/lib/page-guards";
import { vouchersAccess, voucherPages } from "@/modules/vouchers/features/workspace";

export const metadata: Metadata = { title: "Vouchers" };

/** The Vouchers starter page. Its page list follows the person's level. */
export default async function VouchersOverviewPage() {
  const who = vouchersAccess(await pageSession());
  if (!who) notFound();
  return <ModuleStart id="vouchers" groups={[{ label: "", links: voucherPages(who) }]} />;
}
