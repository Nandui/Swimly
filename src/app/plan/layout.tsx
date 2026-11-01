import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { planAccess, PlanShell, planWorkspaceSites } from "@/modules/plan/features/workspace";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Plan (test)", template: TITLE_TEMPLATE } };

/** Plan (test): opens with `plan.view` at any scope; each page limits itself to the sites that grant it. */
export default async function PlanLayout({ children }: { children: ReactNode }) {
  const who = planAccess(await pageSession());
  if (!who) notFound();
  return <PlanShell who={who} sites={await planWorkspaceSites()}>{children}</PlanShell>;
}
