import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { incidentsAccess, IncidentsShell } from "@/modules/incidents/features/workspace";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Incidents", template: TITLE_TEMPLATE } };

/** The Incidents workspace: opens for anyone who may report at some site;
 *  pages limit everyone else's reports to the sites they triage. */
export default async function IncidentsLayout({ children }: { children: ReactNode }) {
  const who = incidentsAccess(await pageSession());
  if (!who) notFound();
  return <IncidentsShell who={who}>{children}</IncidentsShell>;
}
