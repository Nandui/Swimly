import { RecordHistory, RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { formatDateTime } from "@/lib/format";
import { PO_EMAIL_META } from "@/modules/purchasing/shared/rules";

export type OrderEmailRow = { id: string; kind: string; toAddress: string; ccAddress: string; sentByName: string; status: string; error: string; createdAt: Date };

/** Every email of an order, newest first, as the kit's quiet history: sent to the supplier
 *  (green), tests, and failures with why (red). */
export function EmailHistory({ emails }: { emails: OrderEmailRow[] }) {
  if (emails.length === 0) return null;
  return (
    <RecordSection id="po-emails" title="Emails" aside={<p>{emails.length}</p>}>
      <RecordHistory items={emails.map((e) => {
        const kind = e.status === "failed" ? "failed" : e.kind === "test" ? "test" : "supplier";
        return {
          key: e.id, tone: kind === "failed" ? "stop" : kind === "supplier" ? "done" : undefined,
          title: `${e.kind === "test" ? "Test" : "To the supplier"}, ${e.toAddress}`,
          meta: [e.ccAddress ? `Copy to ${e.ccAddress}` : null, `By ${e.sentByName}, ${formatDateTime(e.createdAt)}`, e.status === "failed" ? e.error : null].filter(Boolean).join(" · "),
          extra: <Tag meta={PO_EMAIL_META[kind]} />,
        };
      })} />
    </RecordSection>
  );
}

/** "on 15 Oct 2026, 10:20 to orders@example.com": the last email that reached the supplier, if any. */
export function lastSentToSupplier(emails: OrderEmailRow[]) {
  const last = emails.find((e) => e.kind === "supplier" && e.status === "sent");
  return last ? `on ${formatDateTime(last.createdAt)} to ${last.toAddress}` : null;
}
