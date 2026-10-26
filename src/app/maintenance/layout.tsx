import type { Metadata } from "next";
import type { ReactNode } from "react";
import { screenPage } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import { MaintenanceShell, requireMaintenanceActor } from "@/modules/maintenance/features/workspace";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Maintenance", template: TITLE_TEMPLATE } };
export default async function MaintenanceLayout({ children }: { children: ReactNode }) {
  await screenPage("maintenance");
  const who = await requireMaintenanceActor();
  return <MaintenanceShell who={who}>{children}</MaintenanceShell>;
}
