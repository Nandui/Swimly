import type { Metadata } from "next";
import type { ReactNode } from "react";
import { screenPage } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import { PaymentsShell, requirePaymentsActor } from "@/modules/payments/features/workspace";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Payments", template: TITLE_TEMPLATE } };
export default async function PaymentsLayout({ children }: { children: ReactNode }) {
  await screenPage("payments");
  const who = await requirePaymentsActor();
  return <PaymentsShell who={who}>{children}</PaymentsShell>;
}
