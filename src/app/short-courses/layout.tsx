import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { shortCoursesAccess, ShortCoursesShell } from "@/modules/short-courses/features/workspace";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Short courses", template: TITLE_TEMPLATE } };

/** The Short courses workspace: opens with `short-courses.read` at any scope; pages limit
 *  courses to the sites it covers. */
export default async function ShortCoursesLayout({ children }: { children: ReactNode }) {
  const who = shortCoursesAccess(await pageSession());
  if (!who) notFound();
  return <ShortCoursesShell who={who}>{children}</ShortCoursesShell>;
}
