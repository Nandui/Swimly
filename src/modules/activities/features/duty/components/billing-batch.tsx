"use client";

import { useRouter } from "next/navigation";
import { CircleCheck, FileSpreadsheet, Pencil } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Field, FormDialog } from "@/components/form-dialog";
import { Notice } from "@/components/ui-kit/notice";
import { markLegendProcessed, markRestored, saveLegendPrice } from "@/modules/activities/shared/cancellations/billing-actions";
import { plural } from "@/lib/format";

/** The billing follow-up's two Legend steps (owner decisions, 9 October 2026). Awaiting billing:
 *  export the bulk update, process it in Legend, then mark exactly those classes processed. To
 *  restore: after the direct debit run, export with NewCycleFee from the price list, update
 *  Legend, then mark them restored. Each export names the classes on screen, so the mark that
 *  follows is for the same ones. */
export function BillingBatch({ view, ids, canMark, missing }: { view: "awaiting" | "restore"; ids: string[]; canMark: boolean; missing: string[] }) {
  const router = useRouter();
  const href = `/cancellations/export?${new URLSearchParams({ view, ids: ids.join(",") })}`;
  const restore = view === "restore";
  return (
    <div className="flex flex-col gap-3">
      {restore && missing.length ? (
        <Notice tone="warning" title={`No monthly price for ${missing.join(" and ")} yet`}
          description="NewCycleFee is left empty for those members. Set the price in the swim school's billing prices first." />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline">
          <a href={href} download><FileSpreadsheet aria-hidden="true" />{restore ? "Export price restore" : "Export for Legend"}</a>
        </Button>
        {canMark ? (
          <FormDialog
            trigger={<Button><CircleCheck aria-hidden="true" />{restore ? `Mark ${plural(ids.length, "class")} restored` : `Mark ${plural(ids.length, "class")} processed`}</Button>}
            title={restore ? "Members back on their monthly price?" : "Processed in Legend?"}
            description={restore
              ? `The ${plural(ids.length, "class")} in this list leave To restore once Legend has their members back on their monthly price.`
              : `The ${plural(ids.length, "class")} in this list are billing notified and wait in To restore until the direct debit run is done.`}
            submitLabel={restore ? "Mark restored" : "Mark processed"} successMessage={restore ? "Marked restored" : "Marked processed"}
            onSuccess={() => router.refresh()}
            submit={() => (restore ? markRestored({ ids }) : markLegendProcessed({ ids }))}>
            <p className="text-sm text-ui-muted-foreground">Only after you have used the export in Legend. It goes in the activity log.</p>
          </FormDialog>
        ) : null}
      </div>
    </div>
  );
}

/** One agreement price's monthly price, kept by swim school Manage. */
export function LegendPriceDialog({ price }: { price: { id: string; name: string; monthlyCents: number | null } }) {
  const router = useRouter();
  const fid = `price-${price.id}`;
  return (
    <FormDialog
      trigger={<Button variant="outline" size="icon" aria-label={`Change the monthly price of ${price.name}`}><Pencil aria-hidden="true" /></Button>}
      title={`${price.name}: monthly price`} description="The NewCycleFee that puts members back on it after a cancellation. The same at every site."
      submitLabel="Save price" successMessage="Price saved" onSuccess={() => router.refresh()}
      submit={(fd) => saveLegendPrice({ id: price.id, price: String(fd.get("price") ?? "") })}>
      <Field label="Monthly price (€)" htmlFor={`${fid}-v`} hint="Leave empty to clear it.">
        <Input id={`${fid}-v`} name="price" inputMode="decimal" defaultValue={price.monthlyCents === null ? "" : (price.monthlyCents / 100).toFixed(2)} className="min-h-11" />
      </Field>
    </FormDialog>
  );
}
