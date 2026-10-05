import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClassSession } from "@/modules/activities/components/attendance/class-session";
import { can, canSee } from "@/lib/authz";
import { courseName } from "@/modules/activities/lib/courses/constants";
import { getCourse } from "@/modules/activities/lib/courses/data/courses";
import { legacyClassHref } from "@/modules/activities/lib/attendance/navigation";
import { pageSession } from "@/lib/page-guards";

/** The class name, as the H1 shows it (never its status tag). Asks the same
 *  question as classPage("desk") without its 404, because the page may still
 *  redirect to the deck; getCourse is cached, so the class session reuses it. */
export async function generateMetadata(props: PageProps<"/courses/[id]/class">): Promise<Metadata> {
  const session = await pageSession();
  const desk = (canSee(session, "calendar") || canSee(session, "courses")) && can(session, "attendance.mark");
  if (!desk) return { title: "Class" };
  const course = await getCourse((await props.params).id);
  return { title: course ? courseName(course) : "Page not found" };
}

export default async function ClassPage(props: PageProps<"/courses/[id]/class">) {
  const session = await pageSession();
  const { id } = await props.params;
  const params = await props.searchParams;
  const href = legacyClassHref(id, params, canSee(session, "instructor"), canSee(session, "calendar") || canSee(session, "courses"));
  if (href.startsWith("/instructor/")) redirect(href);
  return <ClassSession id={id} params={params} workspace="desk" />;
}
