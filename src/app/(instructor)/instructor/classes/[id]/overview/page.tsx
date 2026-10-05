import type { Metadata } from "next";
import { InstructorClassSession } from "@/modules/activities/components/instructor/class-session";
import { instructorClassTitle } from "@/modules/activities/lib/attendance/data/instructor-class";

export async function generateMetadata(props: PageProps<"/instructor/classes/[id]/overview">): Promise<Metadata> {
  return { title: await instructorClassTitle((await props.params).id) };
}

export default async function InstructorClassOverviewPage(props: PageProps<"/instructor/classes/[id]/overview">) {
  const { id } = await props.params;
  return <InstructorClassSession id={id} params={await props.searchParams} overview />;
}
