import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { PurchasingShell } from "@/components/purchasing/shell";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import { purchasingAccess } from "@/lib/purchasing/access";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Purchasing", template: TITLE_TEMPLATE } };

/** The Purchasing workspace: opens for the Purchasing screen with
 *  `purchasing.read` at any scope; pages limit orders to the sites it covers. */
export default async function PurchasingLayout({ children }: { children: ReactNode }) {
  const who = purchasingAccess(await pageSession());
  if (!who) notFound();
  return <PurchasingShell who={who}>{children}</PurchasingShell>;
}
