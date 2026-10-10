import type { Metadata } from "next";
import type { ReactNode } from "react";
import { screenPage } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import { RefundShell, requireRefundActor } from "@/modules/refunds/features/workspace";
import '../theme/docs-shell.css';
import '../theme/docs-integration.css';
import './refunds.css';

export const metadata: Metadata = { title: { default: "Refunds", template: TITLE_TEMPLATE } };
export default async function RefundLayout({ children }: { children: ReactNode }) {
  await screenPage("refunds");
  const who = await requireRefundActor();
  // Docs and Refunds shell rules stay scoped to .turnfin-docs, outside the frame, as for Docs.
  return <div className="turnfin-docs"><RefundShell who={who}>{children}</RefundShell></div>;
}
