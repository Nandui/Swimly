import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { screenPage } from "@/lib/page-guards";
import { requireRefundActor } from "@/lib/refunds/auth";
import { RefundShell } from "@/components/refunds/shell";
import '../docs/docs.css';
import '../docs/integration.css';
import '../docs/brand.css';
import './refunds.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';

export const metadata: Metadata = { title: { default: "Turnfin Refunds", template: "%s · Turnfin Refunds" }, icons: { icon: "/brand/turnfin.png" } };
export default async function RefundLayout({ children }: { children: ReactNode }) {
  await screenPage("refunds");
  const who = await requireRefundActor();
  const collapsed = (await cookies()).get('turnfin.refunds.sidebar')?.value === 'collapsed';
  return <RefundShell who={who} initialCollapsed={collapsed}>{children}</RefundShell>;
}
