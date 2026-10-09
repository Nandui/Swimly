import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { AddSwimmer, getStudentCounts, getStudents, STUDENTS_PER_PAGE, SwimmerBrowser, swimmerFilters } from "@/modules/activities/features/students";
import { can } from "@/lib/authz";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Swimmers" };

export default async function StudentsPage(props: PageProps<"/students">) {
  const session = await screenPage("students");
  const params = await props.searchParams;
  const filters = swimmerFilters(params);
  const [result, counts] = await Promise.all([getStudents(filters), getStudentCounts(filters.q)]);
  return <SwimmerBrowser {...filters} {...result} counts={counts} pageSize={STUDENTS_PER_PAGE}
    parentAction={can(session, "parents.manage") ? <Button asChild variant="outline"><Link href="/students/parents">Parent accounts</Link></Button> : null}
    addAction={can(session, "students.manage") ? <AddSwimmer defaultOpen={params.add === "1"} /> : null} />;
}
