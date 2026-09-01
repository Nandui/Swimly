import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { Input } from "@/components/ui/input";
import { AddStudent } from "@/components/students/student-actions";
import { can } from "@/lib/authz";
import { pageSession } from "@/lib/page-guards";
import {
  STUDENTS_PER_PAGE,
  getStudentCounts,
  getStudents,
  type StudentRow,
} from "@/lib/students/data/students";
import { STUDENT_STATUS_META, ageLabel } from "@/lib/students/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Students" };

const LENSES = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "INACTIVE", label: "Inactive" },
] as const;

function lensClass(active: boolean) {
  return cn(
    "flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-[13px] font-medium transition-colors",
    active
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground"
  );
}

export default async function StudentsPage(props: PageProps<"/students">) {
  const session = await pageSession();
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
  const pages = Math.max(1, Math.ceil(total / STUDENTS_PER_PAGE));
  const first = total === 0 ? 0 : (result.page - 1) * STUDENTS_PER_PAGE + 1;
  const last = (result.page - 1) * STUDENTS_PER_PAGE + students.length;
  const pageQuery = (n: number) => ({
    ...(q ? { q } : {}),
    ...(status !== "ALL" ? { status } : {}),
    ...(n > 1 ? { page: String(n) } : {}),
  });

  const countFor = (key: (typeof LENSES)[number]["key"]) =>
    key === "ALL" ? counts.all : key === "ACTIVE" ? counts.active : counts.inactive;

  const filtered = Boolean(q) || status !== "ALL";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Everyone in the water, and how to reach them."
        actions={manage ? <AddStudent /> : null}
      />

      <p className="max-w-prose text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{counts.active}</span> active{" "}
        {counts.active === 1 ? "swimmer" : "swimmers"}
        {counts.inactive > 0 ? (
          <>
            , and{" "}
            <span className="font-medium text-foreground tabular-nums">{counts.inactive}</span> no
            longer coming
          </>
        ) : null}
        .
      </p>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b">
        <div role="group" aria-label="Show" className="-mb-px flex items-center gap-1">
          {LENSES.map((lens) => (
            <Link
              key={lens.key}
              href={
                lens.key === "ALL"
                  ? { pathname: "/students", query: q ? { q } : {} }
                  : { pathname: "/students", query: q ? { q, status: lens.key } : { status: lens.key } }
              }
              aria-current={status === lens.key ? "page" : undefined}
              className={lensClass(status === lens.key)}
            >
              {lens.label}
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {countFor(lens.key)}
              </span>
            </Link>
          ))}
        </div>

        <Form action="/students" className="relative pb-2">
          {status !== "ALL" ? <input type="hidden" name="status" value={status} /> : null}
          <Search
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search name or contact…"
            aria-label="Search students"
            className="h-8 w-56 pl-7"
          />
        </Form>
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filtered ? "Nobody matches that" : "No students yet"}
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

          {pages > 1 ? (
            <nav
              aria-label="Pages of students"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground tabular-nums">
                  {first}–{last}
                </span>{" "}
                of <span className="tabular-nums">{total}</span>
              </p>
              <div className="flex items-center gap-1">
                <PageLink
                  to={pageQuery(result.page - 1)}
                  disabled={result.page <= 1}
                  label="Previous"
                />
                <span className="px-2 text-xs text-muted-foreground tabular-nums">
                  {result.page} of {pages}
                </span>
                <PageLink
                  to={pageQuery(result.page + 1)}
                  disabled={result.page >= pages}
                  label="Next"
                />
              </div>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

/** A disabled page link is a span, not a dimmed link: there is nowhere for it
 *  to go, and a link that goes nowhere is a trap for anyone tabbing through. */
function PageLink({
  to,
  disabled,
  label,
}: {
  to: Record<string, string>;
  disabled: boolean;
  label: string;
}) {
  const className = "rounded-md border px-2.5 py-1 text-[13px] transition-colors";
  if (disabled) {
    return (
      <span aria-disabled className={cn(className, "text-muted-foreground/50")}>
        {label}
      </span>
    );
  }
  return (
    <Link
      href={{ pathname: "/students", query: to }}
      className={cn(className, "text-foreground hover:bg-accent")}
    >
      {label}
    </Link>
  );
}

function StudentTable({ students }: { students: StudentRow[] }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-sidebar">
          <tr className="border-b">
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Name
            </th>
            <th
              scope="col"
              className="w-12 px-3 py-2 text-left text-xs font-medium text-muted-foreground max-md:hidden"
            >
              Age
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium text-muted-foreground max-md:hidden"
            >
              Level
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium text-muted-foreground max-lg:hidden"
            >
              Contact
            </th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const meta = STUDENT_STATUS_META[student.status];
            const levels = student.placements.map((p) => p.levelName).join(", ");
            return (
              <tr
                key={student.id}
                className="group border-b transition-colors last:border-0 hover:bg-accent/40"
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  <Link
                    href={`/students/${student.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {student.firstName} {student.lastName}
                  </Link>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground md:hidden">
                    {student.dateOfBirth ? `${ageLabel(student.dateOfBirth)} · ` : ""}
                    {levels || "Not placed"}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground tabular-nums max-md:hidden">
                  {ageLabel(student.dateOfBirth)}
                </td>
                <td className="px-3 py-2 text-muted-foreground max-md:hidden">
                  {levels || <span className="text-muted-foreground/70">Not placed</span>}
                </td>
                <td className="px-3 py-2 text-muted-foreground max-lg:hidden">
                  {student.contactName ?? "—"}
                  {student.contactPhone ? (
                    <span className="block text-xs">{student.contactPhone}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <Tag color={meta.color}>{meta.label}</Tag>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
