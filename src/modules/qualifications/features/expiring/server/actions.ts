"use server";

import { revalidatePath } from "next/cache";
import { fail, type ActionResult } from "@/lib/action-result";
import { isDateOnly, today } from "@/lib/format";
import { qualificationRenewals } from "@/modules/contributions";
import { requireQualificationsActor } from "@/modules/qualifications/shared/access";

/** Assigns the course that renews an expiring qualification (D26), through the renewals plug:
 *  Training's own assign checks `training.assign` for the person, writes and audits it. Due on the
 *  day the qualification expires, unless that has passed. */
export async function assignRenewal(courseId: string, userId: string, expiresOn: string | null): Promise<ActionResult> {
  await requireQualificationsActor();
  const due = expiresOn && isDateOnly(expiresOn) && expiresOn >= today() ? expiresOn : "";
  const renewals = await qualificationRenewals();
  if (!renewals) return fail("Training is not available, so no course can be assigned from here.");
  const result = await renewals.assign(String(courseId), String(userId), due);
  if (result.ok) revalidatePath("/staff-qualifications");
  return result;
}
