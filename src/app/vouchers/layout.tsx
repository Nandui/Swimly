import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { vouchersAccess, VouchersShell } from "@/modules/vouchers/features/workspace";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Vouchers", template: TITLE_TEMPLATE } };

/** The Vouchers workspace: opens with `vouchers.redeem` at any scope; pages and actions limit
 *  vouchers to the sites it covers. */
export default async function VouchersLayout({ children }: { children: ReactNode }) {
  const who = vouchersAccess(await pageSession());
  if (!who) notFound();
  return <VouchersShell who={who}>{children}</VouchersShell>;
}
