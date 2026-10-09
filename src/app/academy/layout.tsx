import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AcademyShell } from "@/modules/academy/components/shell";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import { academyAccess } from "@/modules/academy/lib/access";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Academy", template: TITLE_TEMPLATE } };

/** The Academy workspace: opens for the Academy screen with `academy.read` at any scope; pages
 *  limit courses to the sites it covers. */
export default async function AcademyLayout({ children }: { children: ReactNode }) {
  const who = academyAccess(await pageSession());
  if (!who) notFound();
  return <AcademyShell who={who}>{children}</AcademyShell>;
}
