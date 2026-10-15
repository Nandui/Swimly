import { Tag } from "@/components/ui-kit/tag";
import { formatDateTime } from "@/lib/format";
import { PO_EMAIL_META } from "@/modules/purchasing/shared/rules";

export type OrderEmailRow = { id: string; kind: string; toAddress: string; ccAddress: string; sentByName: string; status: string; error: string; createdAt: Date };

/** Every email of an order, newest first: sent to the supplier, tests, and failures with why. */
export function EmailHistory({ emails }: { emails: OrderEmailRow[] }) {
  if (emails.length === 0) return null;
  return (
    <section aria-labelledby="po-emails" className="pc-panel" data-print="hide">
      <div className="pc-panel-head"><h2 id="po-emails">Emails</h2></div>
      <ul className="pc-rows">
        {emails.map((e) => (
          <li key={e.id} className="pc-row">
            <span className="pc-row-body">
              <span className="pc-row-title">{e.kind === "test" ? "Test" : "To the supplier"}, {e.toAddress}{e.ccAddress ? `, copy to ${e.ccAddress}` : ""}</span>
              <span className="pc-row-hint">{[`By ${e.sentByName}, ${formatDateTime(e.createdAt)}`, e.status === "failed" ? e.error : null].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="pc-row-trail"><Tag meta={PO_EMAIL_META[e.status === "failed" ? "failed" : e.kind === "test" ? "test" : "supplier"]} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "on 15 Oct 2026, 10:20 to orders@example.com": the last email that reached the supplier, if any. */
export function lastSentToSupplier(emails: OrderEmailRow[]) {
  const last = emails.find((e) => e.kind === "supplier" && e.status === "sent");
  return last ? `on ${formatDateTime(last.createdAt)} to ${last.toAddress}` : null;
}
