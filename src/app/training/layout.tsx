import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { pageSession } from "@/lib/page-guards";
import { trainingAccess } from "@/lib/training/access";
import { TrainingShell } from "@/components/training/shell";
import { NAV_COLLAPSED_COOKIE } from "@/lib/shell-preferences";

export const metadata: Metadata = { title: { default: "Turnfin Training", template: "%s · Turnfin Training" } };

/** The Training Manage surface. Opens for anyone with the Training screen and
 *  a Training capability at any scope (a department or team role counts);
 *  every page limits records to the people that capability covers. */
export default async function TrainingLayout({ children }: { children: ReactNode }) {
  const who = trainingAccess(await pageSession());
  if (!who) notFound();
  const collapsed = (await cookies()).get(NAV_COLLAPSED_COOKIE)?.value === "1";
  return <TrainingShell who={who} initialCollapsed={collapsed}>{children}</TrainingShell>;
}
