import type { Metadata } from "next";
import { InstructorClassSession, instructorClassTitle } from "@/modules/activities/features/instructor";

export async function generateMetadata(props: PageProps<"/instructor/classes/[id]">): Promise<Metadata> {
  return { title: await instructorClassTitle((await props.params).id) };
}

export default async function InstructorClassPage(props: PageProps<"/instructor/classes/[id]">) {
  const { id } = await props.params;
  return <InstructorClassSession id={id} params={await props.searchParams} />;
}
