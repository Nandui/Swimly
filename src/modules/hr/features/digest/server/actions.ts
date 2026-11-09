"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/authz";
import { hrAccess } from "@/modules/hr/shared/access";
import { DigestSettingError, saveDigestRecipients } from "@/modules/hr/features/digest/server/settings";

/** HR > Settings: who gets the daily email of yesterday's reports. Superadmins only. */
export async function saveDigestSettings(addresses: string): Promise<ActionResult> {
  const who = hrAccess(await requireSession());
  if (!who?.superadmin) return fail("Only a superadmin changes who gets the daily HR email.");
  try {
    await saveDigestRecipients(who, String(addresses ?? ""));
  } catch (error) {
    if (error instanceof DigestSettingError) return fail(error.message);
    throw error;
  }
  revalidatePath("/hr/settings");
  return ok();
}
