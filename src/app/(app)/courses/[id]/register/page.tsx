import { redirect } from "next/navigation";

/** The attendance page is the class page now, whichever way you arrive.
 *  This route stays so old links and bookmarks still land somewhere true:
 *  step one of the class page, on the date they asked for. */
export default async function RegisterPage(props: PageProps<"/courses/[id]/register">) {
  const { id } = await props.params;
  const params = await props.searchParams;
  const date = typeof params.date === "string" ? `?date=${encodeURIComponent(params.date)}` : "";
  redirect(`/courses/${id}/class${date}`);
}
