import type { Metadata } from "next";
import { InstructorClassSession } from "@/components/instructor/class-session";

export const metadata: Metadata = { title: "Class overview" };

export default async function InstructorClassOverviewPage(props: PageProps<"/instructor/classes/[id]/overview">) {
  const { id } = await props.params;
  return <InstructorClassSession id={id} params={await props.searchParams} overview />;
}
