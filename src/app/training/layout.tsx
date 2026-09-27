import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { pageSession } from "@/lib/page-guards";
import { trainingAccess } from "@/lib/training/access";
import { TrainingShell } from "@/components/training/shell";
import '../docs/docs.css';
import '../docs/integration.css';
import '../docs/brand.css';
import '../docs/poolside.css';
import './training.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';

export const metadata: Metadata = { title: { default: "Turnfin Training", template: "%s · Turnfin Training" }, icons: { icon: "/brand/turnfin.png" } };

/** The Training Manage surface. Opens for anyone with the Training screen and
 *  a Training capability at any scope (a department or team role counts);
 *  every page limits records to the people that capability covers. */
export default async function TrainingLayout({ children }: { children: ReactNode }) {
  const who = trainingAccess(await pageSession());
  if (!who) notFound();
  const collapsed = (await cookies()).get('turnfin.training.sidebar')?.value === 'collapsed';
  return <TrainingShell who={who} initialCollapsed={collapsed}>{children}</TrainingShell>;
}
