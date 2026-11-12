import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { monitoringAccess, MonitoringShell } from "@/modules/site-monitoring/features/workspace";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Site Monitoring", template: TITLE_TEMPLATE } };

/** The Site Monitoring workspace: opens with `site-monitoring.read` at any scope; pages limit
 *  actions to the sites it covers. */
export default async function SiteMonitoringLayout({ children }: { children: ReactNode }) {
  const who = monitoringAccess(await pageSession());
  if (!who) notFound();
  return <MonitoringShell who={who}>{children}</MonitoringShell>;
}
