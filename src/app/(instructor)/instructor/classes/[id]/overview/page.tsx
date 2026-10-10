import type { Metadata } from "next";
import { InstructorClassSession, instructorClassTitle } from "@/modules/activities/features/instructor";

export async function generateMetadata(props: PageProps<"/instructor/classes/[id]/overview">): Promise<Metadata> {
  return { title: await instructorClassTitle((await props.params).id) };
}

export default async function InstructorClassOverviewPage(props: PageProps<"/instructor/classes/[id]/overview">) {
  const { id } = await props.params;
  return <InstructorClassSession id={id} params={await props.searchParams} overview />;
}
