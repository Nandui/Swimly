import type { Metadata } from "next";
import Form from "next/form";
import { VStack } from "@/components/workspace/layout";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SearchField } from "@/components/ui-kit/search-field";
import { TabStrip } from "@/components/ui-kit/tab-strip";
import { AddStudent } from "@/components/students/student-actions";
import { can } from "@/lib/authz";
import { screenPage } from "@/lib/page-guards";
import {
  STUDENTS_PER_PAGE,
  getStudentCounts,
  getStudents,
} from "@/lib/students/data/students";
import { StudentDirectory } from "@/components/students/student-directory";

export const metadata: Metadata = { title: "Swimmers" };

const LENSES = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "INACTIVE", label: "Inactive" },
] as const;

export default async function StudentsPage(props: PageProps<"/students">) {
  const session = await screenPage("students");
  const manage = can(session, "students.manage");

  const params = await props.searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const raw = typeof params.status === "string" ? params.status : "ALL";
  const status = raw === "ACTIVE" || raw === "INACTIVE" ? raw : "ALL";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);

  const [result, counts] = await Promise.all([
    getStudents({ q, status, page }),
    getStudentCounts(),
  ]);

  const { students, total } = result;
  const query = {
    ...(q ? { q } : {}),
    ...(status !== "ALL" ? { status } : {}),
  };
  const lensHref = (key: (typeof LENSES)[number]["key"]) => {
    const next = new URLSearchParams(q ? { q } : {});
    if (key !== "ALL") next.set("status", key);
    const search = next.toString();
    return search ? `/students?${search}` : "/students";
  };

  const countFor = (key: (typeof LENSES)[number]["key"]) =>
    key === "ALL" ? counts.all : key === "ACTIVE" ? counts.active : counts.inactive;

  const filtered = Boolean(q) || status !== "ALL";

  return (
    <VStack gap={6}>
      <PageHeader
        title="Swimmers"
        description="Everyone in the water, and how to reach them."
        actions={manage ? <AddStudent /> : null}
      />

      <Form action="/students" className="w-full lg:w-[57.45%] lg:pr-6">
        {status !== "ALL" ? <input type="hidden" name="status" value={status} /> : null}
        <SearchField
          label="Search swimmers"
          placeholder="Search name, member number or contact…"
          defaultValue={q}
        />
      </Form>

      <VStack gap={0}>
        <TabStrip
          ariaLabel="Show swimmers"
          countsOnPhone
          items={LENSES.map((lens) => ({
            key: lens.key,
            href: lensHref(lens.key),
            label: lens.label,
            count: countFor(lens.key),
            active: status === lens.key,
          }))}
        />

        {students.length === 0 ? (
          <EmptyState
            icon="users"
            title={filtered ? "Nobody matches that" : "No swimmers yet"}
            hint={
              filtered
                ? "Try a shorter search, or clear the filter."
                : "Add the first swimmer and they will show up here."
            }
            action={!filtered && manage ? <AddStudent /> : null}
          />
        ) : (
          <StudentDirectory
            key={`${q}:${status}:${result.page}:${students[0]?.id}`}
            students={students}
            pagination={total > STUDENTS_PER_PAGE ? (
              <LinkPagination
                label="Pages of swimmers"
                page={result.page}
                totalItems={total}
                pageSize={STUDENTS_PER_PAGE}
                pathname="/students"
                query={query}
              />
            ) : null}
          />
        )}
      </VStack>
    </VStack>
  );
}
