import { CircleCheck, CirclePause, Clock3, HeartPulse, XCircle } from "lucide-react";
import type { StudentStatus } from "@/generated/prisma/client";
import { ageInYears } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";

export const MEDICAL_STATUS_META = {
  notes: { label: "Medical", color: "red", icon: HeartPulse },
} as const satisfies Record<string, StatusMeta>;

/** One map per enum. Adding a status to the schema is a type error here until
 *  it has a label, a tone and an icon, which is how the untinted status gets
 *  caught by the compiler rather than by a reviewer. */
export const STUDENT_STATUS_META: Record<StudentStatus, StatusMeta> = {
  ACTIVE: { label: "Active", color: "green", icon: CircleCheck },
  INACTIVE: { label: "Inactive", color: "gray", icon: CirclePause },
};

/** Domain vocabulary. No call site composes a name or an age by hand. */
export function fullName(student: { firstName: string; lastName: string }): string {
  return `${student.firstName} ${student.lastName}`;
}

export function ageLabel(dateOfBirth: Date | null): string {
  if (!dateOfBirth) return "—";
  return `${ageInYears(dateOfBirth)}`;
}

/** Parents' proposed corrections to contact, emergency and medical details. */
export const PARENT_CHANGE_STATUS_META = {
  PENDING: { label: "Waiting for review", color: "orange", icon: Clock3 },
  APPLIED: { label: "Applied", color: "green", icon: CircleCheck },
  DECLINED: { label: "Declined", color: "gray", icon: XCircle },
} as const satisfies Record<string, StatusMeta>;
