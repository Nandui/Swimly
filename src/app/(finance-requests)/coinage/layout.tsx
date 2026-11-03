import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { screenPage } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import { FinanceShell, financeActor } from "@/modules/finance-requests/features/workspace";
import '../../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Coinage", template: TITLE_TEMPLATE } };

/** Coinage requests in the Finance requests frame (D24); every page checks coinage access again. */
export default async function CoinageLayout({ children }: { children: ReactNode }) {
  await screenPage("coinage");
  const who = await financeActor();
  if (!who?.coinage) notFound();
  return <FinanceShell who={who}>{children}</FinanceShell>;
}
