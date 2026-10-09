import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import { trainingAccess } from "@/modules/training/lib/access";
import { TrainingShell } from "@/modules/training/components/shell";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Training", template: TITLE_TEMPLATE } };

/** The Training Manage surface. Opens for anyone with the Training screen and
 *  a Training capability at any scope (a department or team role counts);
 *  every page limits records to the people that capability covers. */
export default async function TrainingLayout({ children }: { children: ReactNode }) {
  const who = trainingAccess(await pageSession());
  if (!who) notFound();
  return <TrainingShell who={who}>{children}</TrainingShell>;
}
