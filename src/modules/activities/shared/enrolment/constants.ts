import {
  Archive, ArrowRightLeft, CircleArrowRight, CircleCheck, Clock3, Flag, GraduationCap, MapPin, ScanSearch,
  Ticket, TriangleAlert, UserMinus, Users,
} from "lucide-react";
import type { EnrolmentStatus } from "@/generated/prisma/client";
import type { StatusMeta } from "@/lib/status";

export const PLACEMENT_META = {
  otherLevel: { label: "Placed at another level", color: "purple", icon: GraduationCap },
  alreadyEnrolled: { label: "Already in it", color: "green", icon: CircleCheck },
  hasPlace: { label: "Has a place", color: "gray", icon: Ticket },
  differentSite: { label: "Different site", color: "gray", icon: MapPin },
} as const satisfies Record<string, StatusMeta>;

/** Green is current, gray is inert, blue is finished well, purple moved on.
 *  No red: leaving a class is not an emergency. */
export const ENROLMENT_STATUS_META: Record<EnrolmentStatus, StatusMeta> = {
  ACTIVE: { label: "Active", color: "green", icon: CircleCheck },
  WAITLISTED: { label: "Waitlisted", color: "orange", icon: Clock3 },
  COMPLETED: { label: "Completed", color: "blue", icon: Flag },
  WITHDRAWN: { label: "Withdrawn", color: "gray", icon: UserMinus },
  TRANSFERRED: { label: "Transferred", color: "purple", icon: ArrowRightLeft },
};

export const FOLLOW_UP_META = {
  readyToMove: { label: "Ready to move", color: "blue", icon: CircleArrowRight },
  reviewMove: { label: "Needs review", color: "orange", icon: ScanSearch },
  awaiting: { label: "Awaiting class", color: "blue", icon: Clock3 },
  awaitingMove: { label: "Awaiting move", color: "blue", icon: ArrowRightLeft },
  waitlisted: ENROLMENT_STATUS_META.WAITLISTED,
  /** The next contact date has passed ("Overdue · 28 Sep"). */
  overdue: { label: "Overdue", color: "red", icon: TriangleAlert },
} as const satisfies Record<string, StatusMeta>;

export const WAITLIST_AVAILABILITY_META = {
  available: { label: "Space available", color: "green", icon: CircleCheck },
  full: { label: "Class full", color: "gray", icon: Users },
  archived: { label: "Class archived", color: "gray", icon: Archive },
} as const satisfies Record<string, StatusMeta>;
