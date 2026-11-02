import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { pageSession } from "@/lib/page-guards";
import { shortCoursesAccess } from "@/modules/activities/features/short-courses";
import { TITLE_TEMPLATE } from "@/lib/app";

export const metadata: Metadata = { title: { default: "Short courses", template: TITLE_TEMPLATE } };

/** Short courses sit in the swim school's frame (D24): the desk opens them to book (Classes Desk),
 *  instructors to take registers (Pool deck Teach). Each page limits courses to the sites its
 *  permission covers. */
export default async function ShortCoursesLayout({ children }: { children: ReactNode }) {
  if (!shortCoursesAccess(await pageSession())) notFound();
  return children;
}
