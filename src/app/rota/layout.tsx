import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { RotaShell } from "@/components/rota/shell";
import { pageSession } from "@/lib/page-guards";
import { rotaAccess } from "@/lib/rota/access";
import '../docs/docs.css';
import '../docs/integration.css';
import '../docs/poolside.css';
import '../workspace/module-workspace.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';

export const metadata: Metadata = { title: { default: "Turnfin Rota", template: "%s · Turnfin Rota" }, icons: { icon: "/brand/turnfin.png" } };

/** The Rota workspace: opens for the Rota screen with `rota.view` at any
 *  scope; the page limits shifts to the sites that grant covers. */
export default async function RotaLayout({ children }: { children: ReactNode }) {
  const who = rotaAccess(await pageSession());
  if (!who) notFound();
  const collapsed = (await cookies()).get('turnfin.rota.sidebar')?.value === 'collapsed';
  return <RotaShell who={who} initialCollapsed={collapsed}>{children}</RotaShell>;
}
