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
    try { if (await deliverRefundNotifications(row.id, who)) warning = "Saved. Some staff alerts are waiting for delivery; finance can retry them from this request."; }
    catch { warning = "Saved. Email delivery could not be confirmed; finance can retry from the request."; }
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
    return { ok: true, id, version: 0, ...(pending ? { warning: "Some alerts are still waiting. Check staff access and sender settings before retrying." } : {}) };
  } catch (error) { return { ok: false, error: error instanceof RefundError ? error.message : "Could not retry alerts. Try again later." }; }
}
