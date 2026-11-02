"use client";

import { UserX } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { ConfirmAction } from "@/components/confirm-action";
import { plural } from "@/lib/format";
import { removeNonSwimmers } from "@/modules/payments/features/failures/server/actions";

/** Manage's clean-up on the Failed payments page: takes the payments with no swimmer behind them
 *  off the list (from sheets uploaded before Payments tracked swimmers only). Shown only while
 *  there are some; asks first, saying how many reception has already worked on. */
export function RemoveNonSwimmers({ remove, worked }: { remove: number; worked: number }) {
  return (
    <ConfirmAction
      destructive
      trigger={<Button variant="outline"><UserX aria-hidden="true" />Remove {plural(remove, "non-swimmer")}</Button>}
      title={`Remove ${plural(remove, "payment")} that ${remove === 1 ? "isn’t a swimmer" : "aren’t swimmers"}?`}
      description={`${remove === 1 ? "Its member number doesn’t" : "Their member numbers don’t"} belong to a swimmer on Turnfin, so Payments doesn’t track ${remove === 1 ? "it" : "them"}. ${worked ? `${plural(worked, "has", "have")} contacts or an outcome logged; that history goes too. ` : ""}This can’t be undone, but each removal is kept in the activity log.`}
      confirmLabel="Remove them"
      successMessage={`${plural(remove, "payment")} removed`}
      run={removeNonSwimmers}
    />
  );
}
