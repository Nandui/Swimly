"use server";
import { revalidatePath } from "next/cache";
import { requireCoinageActor } from "@/modules/coinage/shared/auth";
import { mutateCoinage } from "@/modules/coinage/shared/service";
import { CoinageError, type CoinageCommand } from "@/modules/coinage/shared/rules";
import { deliverCoinageNotifications } from "@/modules/coinage/features/request/server/notifications";
import type { CoinageResult } from "@/modules/coinage/shared/types";

const UNSENT = "Saved. We couldn’t confirm the email alert; you can send it again from this request.";

export async function saveCoinage(input: CoinageCommand): Promise<CoinageResult> {
  try {
    const who = await requireCoinageActor();
    const row = await mutateCoinage(who, input);
    let warning: string | undefined;
    // Only accounts can send an alert again, so only accounts hears that one didn't go.
    const accounts = who.review || who.process;
    try { if (await deliverCoinageNotifications(row.id, who) && accounts) warning = UNSENT; }
    catch { if (accounts) warning = UNSENT; }
    revalidatePath("/coinage", "layout");
    return { ok: true, id: row.id, version: row.version, ...(warning ? { warning } : {}) };
  } catch (error) {
    return { ok: false, error: error instanceof CoinageError ? error.message : "Could not confirm the save. Your entries are still here. Try again using the same action." };
  }
}
export async function retryCoinageEmails(id: string): Promise<CoinageResult> {
  try {
    const who = await requireCoinageActor();
    if (!who.review && !who.process) throw new CoinageError("Accounts access is required to send alerts again.");
    const pending = await deliverCoinageNotifications(id, who, true);
    revalidatePath("/coinage", "layout");
    return { ok: true, id, version: 0, ...(pending ? { warning: "Some alerts still haven’t gone. Check that the people they go to have Coinage access, then try again later." } : {}) };
  } catch (error) { return { ok: false, error: error instanceof CoinageError ? error.message : "We couldn’t send the alerts again. Try again later." }; }
}
