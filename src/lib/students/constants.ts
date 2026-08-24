import type { TagColor } from "@/components/ui-kit/tag";
import type { StudentStatus } from "@/generated/prisma/client";
import { ageInYears } from "@/lib/format";

/** One map per enum. Adding a status to the schema is a type error here until
 *  it has a label and a tint, which is how the untinted status gets caught by
 *  the compiler rather than by a reviewer. */
export const STUDENT_STATUS_META: Record<StudentStatus, { label: string; color: TagColor }> = {
  ACTIVE: { label: "Active", color: "green" },
  INACTIVE: { label: "Inactive", color: "gray" },
};

/** Domain vocabulary. No call site composes a name or an age by hand. */
export function fullName(student: { firstName: string; lastName: string }): string {
  return `${student.firstName} ${student.lastName}`;
}

/** Two students called Ava Byrne is not hypothetical, and without a family
 *  record there is nothing else to tell them apart. Every picker and every
 *  ambiguous list shows the age alongside the name. */
export function nameWithAge(student: {
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
}): string {
  const name = fullName(student);
  const age = student.dateOfBirth ? ageInYears(student.dateOfBirth) : null;
  return age === null ? name : `${name} · ${age}`;
}

export function ageLabel(dateOfBirth: Date | null): string {
  if (!dateOfBirth) return "—";
  return `${ageInYears(dateOfBirth)}`;
}
