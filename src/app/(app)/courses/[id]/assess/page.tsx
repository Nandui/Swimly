import { redirect } from "next/navigation";

/** The competencies page is step two of the class page now, whichever way
 *  you arrive. This route stays so old links still land somewhere true. */
export default async function AssessPage(props: PageProps<"/courses/[id]/assess">) {
  const { id } = await props.params;
  redirect(`/courses/${id}/class?step=competencies`);
}
