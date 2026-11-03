import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import { qualificationsAccess, QualificationsShell } from "@/modules/qualifications/features/workspace";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Qualifications", template: TITLE_TEMPLATE } };

/** The Qualifications workspace: opens with `qualifications.manage` at any scope; every page
 *  limits records to the people it covers. */
export default async function QualificationsLayout({ children }: { children: ReactNode }) {
  const who = qualificationsAccess(await pageSession());
  if (!who) notFound();
  return <QualificationsShell who={who}>{children}</QualificationsShell>;
}
