import type { TagColor } from "@/components/ui-kit/tag";
import type { CompetencyStatus } from "@/generated/prisma/client";

/** Two states, plus the absence of a row. "Not assessed" deliberately has no
 *  enum value and no tag — a judgement nobody has made yet is a muted dash,
 *  not a status. */
export const COMPETENCY_STATUS_META: Record<
  CompetencyStatus,
  { label: string; color: TagColor }
> = {
  WORKING_ON: { label: "Working on it", color: "yellow" },
  ACHIEVED: { label: "Achieved", color: "green" },
};

export const NOT_ASSESSED = "Not assessed";

/** The order the three choices appear on the assessment control. */
export const ASSESSMENT_CHOICES = ["NONE", "WORKING_ON", "ACHIEVED"] as const;
export type AssessmentChoice = (typeof ASSESSMENT_CHOICES)[number];

export function progressLabel(achieved: number, total: number): string {
  if (total === 0) return "No competencies set yet";
  return `${achieved} of ${total}`;
}
