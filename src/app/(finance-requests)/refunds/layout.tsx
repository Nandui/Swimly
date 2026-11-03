import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { screenPage } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import { FinanceShell, financeActor } from "@/modules/finance-requests/features/workspace";
import '../../theme/docs-shell.css';
import '../../theme/docs-integration.css';
import './refunds.css';

export const metadata: Metadata = { title: { default: "Refunds", template: TITLE_TEMPLATE } };

/** Refund requests in the Finance requests frame (D24); every page checks refunds access again. */
export default async function RefundLayout({ children }: { children: ReactNode }) {
  await screenPage("refunds");
  const who = await financeActor();
  if (!who?.refunds) notFound();
  // Docs and Refunds shell rules stay scoped to .turnfin-docs, outside the frame, as for Docs.
  return <div className="turnfin-docs"><FinanceShell who={who} contentClass="refund-content">{children}</FinanceShell></div>;
}
