import { redirect } from "next/navigation";
import { canSee } from "@/lib/authz";
import { legacyClassHref } from "@/lib/attendance/navigation";
import { pageSession } from "@/lib/page-guards";

/** The competencies page is step two of the class page now, whichever way
 *  you arrive. This route stays so old links still land somewhere true. */
export default async function AssessPage(props: PageProps<"/courses/[id]/assess">) {
  const { id } = await props.params;
  const params = await props.searchParams;
  const session = await pageSession();
  redirect(legacyClassHref(id, { ...params, step: "competencies" }, canSee(session, "instructor"), canSee(session, "calendar") || canSee(session, "courses")));
}
