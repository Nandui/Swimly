import { redirect } from "next/navigation";
import { screenPage } from "@/lib/page-guards";

/** Preserve bookmarks while enforcing the independent screen grant. */
export default async function PreviousAwaitingEnrolmentPage({ searchParams }: PageProps<"/assessments/awaiting-enrolment">) {
  await screenPage("awaiting-enrolment");
  const query = await searchParams;
  const next = new URLSearchParams();
  for (const key of ["q", "page"]) {
    if (typeof query[key] === "string") next.set(key, query[key]);
  }
  redirect(`/awaiting-enrolment${next.size ? `?${next}` : ""}`);
}
