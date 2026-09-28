import type { TagColor } from "@/components/ui-kit/tag";
import type { CompetencyStatus } from "@/generated/prisma/client";

/** Missing results display as Not Achieved. WORKING_ON is the existing stored
 *  value for Not Achieved; retain it to preserve historical results. */
export const COMPETENCY_STATUS_META: Record<
  CompetencyStatus,
  { label: string; color: TagColor }
> = {
  WORKING_ON: { label: "Not Achieved", color: "yellow" },
  ACHIEVED: { label: "Achieved", color: "green" },
};


export const LEVEL_PROGRESS_META = {
  graduated: { label: "Graduated", color: "blue" },
  eligible: { label: "Ready to complete", color: "green" },
  inProgress: { label: "In progress", color: "yellow" },
} as const satisfies Record<string, { label: string; color: TagColor }>;

export const COMPLETION_META = {
  earned: { color: "green" },
  override: { color: "orange" },
} as const satisfies Record<string, { color: TagColor }>;

/** The order the two choices appear on the competency control. */
export const ASSESSMENT_CHOICES = ["WORKING_ON", "ACHIEVED"] as const;
export type AssessmentChoice = (typeof ASSESSMENT_CHOICES)[number];

export function progressLabel(achieved: number, total: number): string {
  if (total === 0) return "No competencies set yet";
  return `${achieved} of ${total}`;
}
