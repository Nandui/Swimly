import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import { FinanceShell, financeActor } from "@/modules/finance-requests/features/workspace";
import '../../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Finance requests", template: TITLE_TEMPLATE } };

/** Finance requests' starter page: opens with refunds or coinage access. */
export default async function FinanceRequestsLayout({ children }: { children: ReactNode }) {
  await pageSession();
  const who = await financeActor();
  if (!who) notFound();
  return <FinanceShell who={who}>{children}</FinanceShell>;
}
