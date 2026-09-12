import type { Metadata } from "next";
import { AddSwimmer } from "@/components/students/add-swimmer";
import { SwimmerBrowser } from "@/components/students/swimmer-browser";
import { can } from "@/lib/authz";
import { screenPage } from "@/lib/page-guards";
import { STUDENTS_PER_PAGE, getStudentCounts, getStudents } from "@/lib/students/data/students";
import { swimmerFilters } from "@/lib/students/directory";

export const metadata: Metadata = { title: "Swimmers" };

export default async function StudentsPage(props: PageProps<"/students">) {
  const session = await screenPage("students");
  const filters = swimmerFilters(await props.searchParams);
  const [result, counts] = await Promise.all([getStudents(filters), getStudentCounts()]);
  return <SwimmerBrowser {...filters} {...result} counts={counts} pageSize={STUDENTS_PER_PAGE} addAction={can(session, "students.manage") ? <AddSwimmer /> : null} />;
}
