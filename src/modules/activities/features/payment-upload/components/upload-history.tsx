"use client";

import { FileSpreadsheet, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { ConfirmAction } from "@/components/confirm-action";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { formatDateTime, plural } from "@/lib/format";
import { removeUpload } from "@/modules/activities/features/payment-upload/server/actions";
import type { UploadHistoryRow } from "@/modules/activities/features/payment-upload/server/history";
import { monthLabel } from "@/modules/activities/shared/payments/types";

/** The latest uploads under the form, each with Remove this upload while any payment it added is
 *  still on the list (owner, 3 November 2026: for a wrong sheet). Asks first, saying how many go
 *  and how many reception has already worked on. */
export function UploadHistory({ uploads }: { uploads: UploadHistoryRow[] }) {
  return (
    <section aria-labelledby="pay-uploads-h" className="flex min-w-0 flex-col">
      <div className="pc-section-head"><h2 id="pay-uploads-h">Recent uploads</h2>{uploads.length ? <p>{uploads.length}</p> : null}</div>
      {uploads.length === 0 ? (
        <div className="pc-list"><EmptyState compact icon="clipboardList" title="No sheets uploaded yet" /></div>
      ) : (
        <ul className="pc-list">
          {uploads.map((u) => (
            <li key={u.id} className="pc-row">
              <span className="pc-tile-icon"><FileSpreadsheet aria-hidden="true" /></span>
              <span className="pc-row-body">
                <span className="pc-row-title break-words">{u.fileName}</span>
                <span className="pc-row-hint">
                  {[`For ${monthLabel(u.month)}`, `by ${u.uploadedByName}, ${formatDateTime(new Date(u.createdAt))}`,
                    u.onList ? `${plural(u.onList, "payment")} on the list` : "Nothing from it left on the list"].join(" · ")}
                </span>
              </span>
              {u.onList ? (
                <span className="pc-row-trail">
                  <ConfirmAction
                    destructive
                    trigger={<Button variant="outline"><Trash2 aria-hidden="true" />Remove this upload<span className="sr-only">: {u.fileName}</span></Button>}
                    title={`Remove the ${plural(u.onList, "payment")} from ${u.fileName}?`}
                    description={`Every payment this upload added for ${monthLabel(u.month)} comes off the list. ${u.worked ? `${plural(u.worked, "has", "have")} contacts or an outcome logged; that history goes too. ` : ""}You can then upload the right sheet. This can’t be undone, but each removal is kept in the activity log.`}
                    confirmLabel="Remove upload"
                    successMessage={`${plural(u.onList, "payment")} removed`}
                    run={() => removeUpload(u.id)}
                  />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
