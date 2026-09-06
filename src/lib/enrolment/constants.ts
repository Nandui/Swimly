import type { TagColor } from "@/components/ui-kit/tag";
import type { EnrolmentStatus } from "@/generated/prisma/client";
import type { StatusMeta } from "@/lib/status";

export const PLACEMENT_META = {
  otherLevel: { label: "Placed at another level", color: "purple" },
  alreadyEnrolled: { label: "Already in it", color: "green" },
  hasPlace: { label: "Has a place", color: "gray" },
} as const satisfies Record<string, StatusMeta>;

/** Green is current, gray is inert, blue is finished well, purple moved on.
 *  No red: leaving a class is not an emergency. */
export const ENROLMENT_STATUS_META: Record<
  EnrolmentStatus,
  { label: string; color: TagColor }
> = {
  ACTIVE: { label: "Active", color: "green" },
  WAITLISTED: { label: "Waitlisted", color: "yellow" },
  COMPLETED: { label: "Completed", color: "blue" },
  WITHDRAWN: { label: "Withdrawn", color: "gray" },
  TRANSFERRED: { label: "Transferred", color: "purple" },
};

/** The statuses that still mean "in this class". */
export const OPEN_STATUSES = ["ACTIVE", "WAITLISTED"] as const;
