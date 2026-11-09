"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/authz";
import { needsStepUp } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";
import { hrAccess } from "@/modules/hr/shared/access";
import { DigestSettingError, saveDigestRecipients } from "@/modules/hr/features/digest/server/settings";

/** HR > Settings: who gets the daily email of yesterday's reports. Needs
 *  `hr.digest.manage`, restricted, so a recent password too. */
export async function saveDigestSettings(addresses: string): Promise<ActionResult> {
  const session = await requireSession();
  const who = hrAccess(session);
  if (!who?.digest) return fail("Changing who gets the daily HR email needs the HR tick \"Keeps the daily reports email\".");
  if (needsStepUp(actorForSession(session), "hr.digest.manage")) return fail("Sign in again to change this: reload the page and confirm it's you.");
  try {
    await saveDigestRecipients(who, String(addresses ?? ""));
  } catch (error) {
    if (error instanceof DigestSettingError) return fail(error.message);
    throw error;
  }
  revalidatePath("/hr/settings");
  return ok();
}
