import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClassSession } from "@/components/attendance/class-session";
import { canSee } from "@/lib/authz";
import { legacyClassHref } from "@/lib/attendance/navigation";
import { pageSession } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Class" };

export default async function ClassPage(props: PageProps<"/courses/[id]/class">) {
  const session = await pageSession();
  const { id } = await props.params;
  const params = await props.searchParams;
  const href = legacyClassHref(id, params, canSee(session, "instructor"), canSee(session, "calendar") || canSee(session, "courses"));
  if (href.startsWith("/instructor/")) redirect(href);
  return <ClassSession id={id} params={params} workspace="desk" />;
}
