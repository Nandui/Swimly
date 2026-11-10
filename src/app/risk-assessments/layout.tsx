import type { Metadata } from "next";
import type { ReactNode } from "react";
import { screenPage } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import { requireRiskActor, RiskShell } from "@/modules/risk/features/workspace";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Risk assessments", template: TITLE_TEMPLATE } };

/** The Risk assessments workspace: opens for anyone who reads them at some site; every page
 *  limits itself to the sites the person covers. */
export default async function RiskLayout({ children }: { children: ReactNode }) {
  await screenPage("risk-assessments");
  const who = await requireRiskActor();
  return <RiskShell who={{ id: who.id, name: who.name, write: who.write }}>{children}</RiskShell>;
}
