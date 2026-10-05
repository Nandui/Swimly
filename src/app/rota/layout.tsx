import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { RotaShell } from "@/components/rota/shell";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import { rotaAccess } from "@/lib/rota/access";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Rota", template: TITLE_TEMPLATE } };

/** The Rota workspace: opens for the Rota screen with `rota.view` at any
 *  scope; the page limits shifts to the sites that grant covers. */
export default async function RotaLayout({ children }: { children: ReactNode }) {
  const who = rotaAccess(await pageSession());
  if (!who) notFound();
  return <RotaShell who={who}>{children}</RotaShell>;
}
