"use client";

import { Select } from "@/components/ui/select";
import { LEAVE_REASON_CHOICES } from "@/modules/activities/shared/enrolment/leave-reasons";

/** Why the swimmer is leaving this class. Required when a place is withdrawn
 *  or its last lesson is set, so Analytics can explain leavers. */
export function LeaveReasonField({ defaultValue }: { defaultValue?: string | null }) {
  return <Select
    name="leaveReason"
    label="Why are they leaving?"
    description="Pick the main reason. Add detail in the note if it helps."
    required
    placeholder="Choose a reason"
    defaultValue={defaultValue ?? undefined}
    options={LEAVE_REASON_CHOICES}
  />;
}
