import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { rotaAccess, RotaShell, rotaSites } from "@/modules/rota/features/workspace";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Rota", template: TITLE_TEMPLATE } };

/** The Rota workspace: opens for the Rota screen with `rota.view` at any
 *  scope; the page limits shifts to the sites that grant covers. */
export default async function RotaLayout({ children }: { children: ReactNode }) {
  const who = rotaAccess(await pageSession());
  if (!who) notFound();
  // The site picker's list, in rotaWeek's order (its first site is the default).
  const { sites } = await rotaSites();
  return <RotaShell who={who} sites={sites.map(({ id, name }) => ({ id, name }))}>{children}</RotaShell>;
}
