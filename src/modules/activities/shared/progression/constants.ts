import { Award, CircleCheck, CircleDashed, GraduationCap, Loader, TriangleAlert } from "lucide-react";
import type { CompetencyStatus } from "@/generated/prisma/client";
import type { StatusMeta } from "@/lib/status";

/** Missing results display as Not achieved. WORKING_ON is the existing stored
 *  value for Not achieved; retain it to preserve historical results. */
export const COMPETENCY_STATUS_META: Record<CompetencyStatus, StatusMeta> = {
  WORKING_ON: { label: "Not achieved", color: "orange", icon: CircleDashed },
  ACHIEVED: { label: "Achieved", color: "green", icon: CircleCheck },
};

/** A competency starts as Not achieved: a skill nobody has marked yet reads,
 *  counts and saves as WORKING_ON (owner decision, 21 October 2026). No row is
 *  written until someone marks it, so who marked it and when stay true. */
export function markOrDefault(status: CompetencyStatus | null | undefined): CompetencyStatus {
  return status ?? "WORKING_ON";
}

export const LEVEL_PROGRESS_META = {
  graduated: { label: "Graduated", color: "blue", icon: GraduationCap },
  eligible: { label: "Ready to complete", color: "green", icon: CircleCheck },
  inProgress: { label: "In progress", color: "orange", icon: Loader },
} as const satisfies Record<string, StatusMeta>;

export const COMPLETION_META = {
  earned: { label: "Completed", color: "green", icon: Award },
  override: { label: "Completed with gaps", color: "orange", icon: TriangleAlert },
} as const satisfies Record<string, StatusMeta>;

/** The order the two choices appear on the competency control. */
export const ASSESSMENT_CHOICES = ["WORKING_ON", "ACHIEVED"] as const;
