"use server";
import { revalidatePath } from "next/cache";
import { requireRefundActor } from "@/lib/refunds/auth";
import { mutateRefund } from "@/lib/refunds/service";
import { RefundError, type RefundCommand } from "@/lib/refunds/rules";
import { deliverRefundNotifications } from "@/lib/refunds/notifications";
import type { RefundResult } from "@/lib/refunds/types";

export async function saveRefund(input: RefundCommand): Promise<RefundResult> {
  try {
    const who = await requireRefundActor();
    const row = await mutateRefund(who, input);
    let warning: string | undefined;
    // Only finance can send an alert again, so only finance hears that one didn't go.
    const finance = who.review || who.process;
    try { if (await deliverRefundNotifications(row.id, who) && finance) warning = "Saved. We couldn’t confirm the email alert; you can send it again from this request."; }
    catch { if (finance) warning = "Saved. We couldn’t confirm the email alert; you can send it again from this request."; }
    revalidatePath("/refunds", "layout");
    return { ok: true, id: row.id, version: row.version, ...(warning ? { warning } : {}) };
  } catch (error) {
    return { ok: false, error: error instanceof RefundError ? error.message : "Could not confirm the save. Your entries are still here. Try again using the same action." };
  }
}
export async function retryRefundEmails(id: string): Promise<RefundResult> {
  try {
    const who = await requireRefundActor();
    if (!who.review && !who.process) throw new RefundError("Finance access is required to retry staff alerts.");
    const pending = await deliverRefundNotifications(id, who, true);
    revalidatePath("/refunds", "layout");
    return { ok: true, id, version: 0, ...(pending ? { warning: "Some alerts still haven’t gone. Check that the people they go to have Refunds access, then try again later." } : {}) };
  } catch (error) { return { ok: false, error: error instanceof RefundError ? error.message : "We couldn’t send the alerts again. Try again later." }; }
}
