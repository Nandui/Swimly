import type { Metadata } from "next";
import Form from "next/form";
import { Link } from "@astryxdesign/core/Link";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { SearchField } from "@/components/ui-kit/search-field";
import { TabStrip } from "@/components/ui-kit/tab-strip";
import { Tag } from "@/components/ui-kit/tag";
import { AddStudent } from "@/components/students/student-actions";
import { can } from "@/lib/authz";
import { screenPage } from "@/lib/page-guards";
import {
  STUDENTS_PER_PAGE,
  getStudentCounts,
  getStudents,
  type StudentRow,
} from "@/lib/students/data/students";
import { STUDENT_STATUS_META, ageLabel } from "@/lib/students/constants";

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

      <Lead>
        <Num>{counts.active}</Num> active {counts.active === 1 ? "swimmer" : "swimmers"}
        {counts.inactive > 0 ? (
          <>
            , and <Num>{counts.inactive}</Num> no longer coming
          </>
        ) : null}
        .
      </Lead>

      <HStack gap={4} wrap="wrap" vAlign="end" hAlign="between">
        <StackItem size="fill" className="max-sm:basis-full">
          <TabStrip
            ariaLabel="Show"
            countsOnPhone
            items={LENSES.map((lens) => ({
              key: lens.key,
              href: lensHref(lens.key),
              label: lens.label,
              count: countFor(lens.key),
              active: status === lens.key,
            }))}
          />
        </StackItem>
        <Form action="/students" className="max-sm:w-full">
          {status !== "ALL" ? <input type="hidden" name="status" value={status} /> : null}
          <SearchField
            label="Search swimmers"
            placeholder="Search name or contact…"
            defaultValue={q}
            width={224}
          />
        </Form>
      </HStack>

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
        <>
          <StudentTable students={students} />
          {total > STUDENTS_PER_PAGE ? (
            <LinkPagination
              label="Pages of swimmers"
              page={result.page}
              totalItems={total}
              pageSize={STUDENTS_PER_PAGE}
              pathname="/students"
              query={query}
            />
          ) : null}
        </>
      )}
    </VStack>
  );
}

/** Below `md` the age and the level re-home under the name; the contact
 *  column waits for a wide screen. */
function StudentTable({ students }: { students: StudentRow[] }) {
  return (
    <Table hasHover textOverflow="wrap">
      <TableHeader>
        <TableRow isHeaderRow>
          <TableHeaderCell scope="col">Name</TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            Age
          </TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            Level
          </TableHeaderCell>
          <TableHeaderCell scope="col" className="max-lg:hidden">
            Contact
          </TableHeaderCell>
          <TableHeaderCell scope="col">Status</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((student) => {
          const meta = STUDENT_STATUS_META[student.status];
          const levels = student.placements.map((p) => p.levelName).join(", ");
          return (
            <TableRow key={student.id}>
              <TableCell>
                <Link href={`/students/${student.id}`} weight="medium">
                  {student.firstName} {student.lastName}
                </Link>
                <Text type="supporting" display="block" className="md:hidden">
                  {student.dateOfBirth ? `${ageLabel(student.dateOfBirth)} · ` : ""}
                  {levels || "Not placed"}
                </Text>
                {student.contactName || student.contactPhone ? (
                  <Text type="supporting" display="block" className="lg:hidden">
                    {student.contactName}
                    {student.contactName && student.contactPhone ? " · " : ""}
                    {student.contactPhone ? (
                      <Link href={`tel:${student.contactPhone.replace(/\s+/g, "")}`}>
                        {student.contactPhone}
                      </Link>
                    ) : null}
                  </Text>
                ) : null}
              </TableCell>
              <TableCell className="max-md:hidden">
                <Text color="secondary" hasTabularNumbers>
                  {ageLabel(student.dateOfBirth)}
                </Text>
              </TableCell>
              <TableCell className="max-md:hidden">
                {levels ? (
                  <Text color="secondary">{levels}</Text>
                ) : (
                  <Text color="secondary">Not placed</Text>
                )}
              </TableCell>
              <TableCell className="max-lg:hidden">
                {student.contactName ? (
                  <>
                    <Text color="secondary">{student.contactName}</Text>
                    {student.contactPhone ? (
                      <Text type="supporting" display="block" hasTabularNumbers>
                        {student.contactPhone}
                      </Text>
                    ) : null}
                  </>
                ) : student.contactPhone ? (
                  <Text color="secondary" hasTabularNumbers>
                    {student.contactPhone}
                  </Text>
                ) : (
                  <Text color="secondary">—</Text>
                )}
              </TableCell>
              <TableCell>
                <Tag color={meta.color}>{meta.label}</Tag>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
