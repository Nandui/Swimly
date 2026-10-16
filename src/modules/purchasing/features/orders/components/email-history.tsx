import { Tag } from "@/components/ui-kit/tag";
import { formatDateTime } from "@/lib/format";
import { PO_EMAIL_META } from "@/modules/purchasing/shared/rules";

export type OrderEmailRow = { id: string; kind: string; toAddress: string; ccAddress: string; sentByName: string; status: string; error: string; createdAt: Date };

/** Every email of an order, newest first, as a quiet timeline: sent to the supplier, tests,
 *  and failures with why. */
export function EmailHistory({ emails }: { emails: OrderEmailRow[] }) {
  if (emails.length === 0) return null;
  return (
    <section aria-labelledby="po-emails" className="po-card" data-print="hide">
      <div className="po-card-head"><h2 id="po-emails">Emails<span className="po-count">{emails.length}</span></h2></div>
      <ol className="po-history">
        {emails.map((e) => {
          const kind = e.status === "failed" ? "failed" : e.kind === "test" ? "test" : "supplier";
          return (
            <li key={e.id} data-kind={kind}>
              <span className="po-history-dot" aria-hidden="true" />
              <div className="po-history-body">
                <p className="po-history-title">{e.kind === "test" ? "Test" : "To the supplier"}, {e.toAddress}</p>
                <p className="po-history-meta">{[e.ccAddress ? `Copy to ${e.ccAddress}` : null, `By ${e.sentByName}, ${formatDateTime(e.createdAt)}`, e.status === "failed" ? e.error : null].filter(Boolean).join(" · ")}</p>
                <Tag meta={PO_EMAIL_META[kind]} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** "on 15 Oct 2026, 10:20 to orders@example.com": the last email that reached the supplier, if any. */
export function lastSentToSupplier(emails: OrderEmailRow[]) {
  const last = emails.find((e) => e.kind === "supplier" && e.status === "sent");
  return last ? `on ${formatDateTime(last.createdAt)} to ${last.toAddress}` : null;
}
