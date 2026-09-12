import { redirect } from "next/navigation";
import { canSee } from "@/lib/authz";
import { legacyClassHref } from "@/lib/attendance/navigation";
import { pageSession } from "@/lib/page-guards";

/** The attendance page is the class page now, whichever way you arrive.
 *  This route stays so old links and bookmarks still land somewhere true:
 *  step one of the class page, on the date they asked for. */
export default async function RegisterPage(props: PageProps<"/courses/[id]/register">) {
  const { id } = await props.params;
  const params = await props.searchParams;
  const session = await pageSession();
  redirect(legacyClassHref(id, { ...params, step: "attendance" }, canSee(session, "instructor"), canSee(session, "calendar") || canSee(session, "courses")));
}
