import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { stockAccess, StockShell } from "@/modules/stock/features/workspace";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Stock", template: TITLE_TEMPLATE } };

/** The Stock workspace: opens with `stock.read` at any scope; pages limit counts to the sites it covers. */
export default async function StockLayout({ children }: { children: ReactNode }) {
  const who = stockAccess(await pageSession());
  if (!who) notFound();
  return <StockShell who={who}>{children}</StockShell>;
}
