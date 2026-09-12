import type { Metadata } from "next";
import { InstructorClassSession } from "@/components/instructor/class-session";

export const metadata: Metadata = { title: "Teach class" };

export default async function InstructorClassPage(props: PageProps<"/instructor/classes/[id]">) {
  const { id } = await props.params;
  return <InstructorClassSession id={id} params={await props.searchParams} />;
}
