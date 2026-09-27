import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { RotaShell } from "@/components/rota/shell";
import { pageSession } from "@/lib/page-guards";
import { rotaAccess } from "@/lib/rota/access";
import { NAV_COLLAPSED_COOKIE } from "@/lib/shell-preferences";

export const metadata: Metadata = { title: { default: "Turnfin Rota", template: "%s · Turnfin Rota" } };

/** The Rota workspace: opens for the Rota screen with `rota.view` at any
 *  scope; the page limits shifts to the sites that grant covers. */
export default async function RotaLayout({ children }: { children: ReactNode }) {
  const who = rotaAccess(await pageSession());
  if (!who) notFound();
  const collapsed = (await cookies()).get(NAV_COLLAPSED_COOKIE)?.value === "1";
  return <RotaShell who={who} initialCollapsed={collapsed}>{children}</RotaShell>;
}
