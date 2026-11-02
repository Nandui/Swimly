import Link from "next/link";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordFacts, RecordHistory, RecordNext, RecordSection, RecordSteps, type RecordStepState } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, formatDateTime, plural } from "@/lib/format";
import { FollowUpActions } from "@/modules/activities/features/failed-payments/components/follow-up-actions";
import type { getPaymentFailure } from "@/modules/activities/features/failed-payments/server/data";
import { euro, METHOD_LABEL, monthLabel, PAYMENT_ACTIONS, PAYMENT_STATUS_META, RESULT_LABEL, RETURN_ADVICE, type ContactMethod, type ContactResult, type PaymentAction, type PaymentView } from "@/modules/activities/shared/payments/types";

type Data = Awaited<ReturnType<typeof getPaymentFailure>>;

/** Where it has got to: on the sheet, contacted, recovered. A cancelled place stops at the last
 *  step it reached. */
function steps(r: PaymentView): { label: string; hint: string; state: RecordStepState }[] {
  const closed = r.status === "paid" || r.status === "new_mandate" || r.status === "cancelled";
  return [
    { label: "Failed", hint: `${monthLabel(r.month)} direct debit, on the sheet ${formatDate(new Date(r.createdAt))}`, state: "done" },
    { label: "Contacted", hint: r.attempts ? `${plural(r.attempts, "time")}${r.lastContactAt ? `, last ${formatDate(new Date(r.lastContactAt))}` : ""}` : closed ? "Not recorded" : "Reception gets in touch",
      state: r.status === "to_contact" ? "current" : r.status === "contacted" ? "waiting" : r.attempts ? "done" : "skipped" },
    r.status === "cancelled"
      ? { label: "Place cancelled", hint: r.closedAt ? formatDate(new Date(r.closedAt)) : "", state: "stopped" }
      : { label: "Recovered", hint: closed && r.closedAt ? `${PAYMENT_STATUS_META[r.status].label}, ${formatDate(new Date(r.closedAt))}` : "Not yet", state: closed ? "done" : "todo" },
  ];
}
const historyTone = (a: PaymentAction) => (a === "paid" || a === "new_mandate" ? "done" as const : a === "reopen" ? "warn" as const : a === "cancelled" ? "stop" as const : undefined);

function nextStep(r: PaymentView, follow: boolean) {
  if (r.status === "to_contact") return follow ? "Contact them about the failed payment, then log it here. Take the money in Legend, not Turnfin." : "Reception will contact them about the failed payment.";
  if (r.status === "contacted") return follow ? "Waiting on them. Contact them again if nothing comes in, and record how it ends once they pay or set up a new mandate." : "Reception has been in touch and is waiting on them.";
  if (r.status === "cancelled") return "The place was cancelled, so the money is not being chased. Its history is kept.";
  return "Recovered. If it turns out it was not, a manager can open it again.";
}

/** One failed payment as a record page (ui-kit/record.tsx), as Maintenance and Refunds are: what
 *  happens next and where it has got to beside it, tinted blue while the move is this person's;
 *  who to contact, the payment and what the bank said, the member's other failures, the history. */
export function FailureView({ data }: { data: Data }) {
  const r = data.failure, m = data.member;
  const act = data.can.follow && (r.status === "to_contact" || r.status === "contacted");
  const advice = RETURN_ADVICE[r.returnCode];
  return (
    <PageShell spacing="roomy" header={<PageHeader back={{ href: "/payments", label: "Failed payments" }}
        eyebrow={<p className="rec-head"><Tag meta={PAYMENT_STATUS_META[r.status]} /><span className="tabular-nums">{r.reference}</span></p>}
        title={r.name}
        description={`${euro(r.amountCents)} · ${monthLabel(r.month)} direct debit · ${r.siteName}`} />}>
      <div className="rec-layout">
        <RecordNext act={act} label={act ? "Your move" : "Where it stands"} body={nextStep(r, data.can.follow)}>
          {data.can.follow || data.can.manage ? <FollowUpActions failure={r} follow={data.can.follow} manage={data.can.manage} /> : null}
          <RecordSteps steps={steps(r)} label="Where the payment has got to" />
        </RecordNext>
        <div className="rec-main">
          <RecordSection id="pay-contact-h" title="Who to contact">
            <div className="rec-card">
              {m ? (
                <RecordFacts items={[
                  ["Swimmer", <Link key="swimmer" href={`/students/${m.id}`} className="underline-offset-4 hover:underline">{m.name}</Link>],
                  ["Contact", m.contactName || "Not given"],
                  ["Phone", m.contactPhone ? <a key="phone" href={`tel:${m.contactPhone.replace(/\s+/g, "")}`} className="tabular-nums underline-offset-4 hover:underline">{m.contactPhone}</a> : "Not given"],
                  ["Email", m.contactEmail ? <a key="email" href={`mailto:${m.contactEmail}`} className="break-all underline-offset-4 hover:underline">{m.contactEmail}</a> : "Not given"],
                ]} />
              ) : (
                <RecordFacts items={[
                  ["Account holder", r.name],
                  ["Member number", r.memberNumber || "Not on the sheet"],
                  ["Contact details", r.memberNumber ? "Not on the swimmer records. Find the member in Legend by their member number." : "Find the member in Legend by their name.", true],
                ]} />
              )}
            </div>
          </RecordSection>
          <RecordSection id="pay-payment-h" title="The payment">
            <div className="rec-card">
              <RecordFacts items={[
                ["Amount", euro(r.amountCents)],
                ["Month", monthLabel(r.month)],
                ["Site", r.siteName],
                ["Reference", r.reference],
                ...(m ? [["Member number", r.memberNumber] as [string, string]] : []),
                ["Why it failed", [r.returnCode, r.returnReason].filter(Boolean).join(" · ") || "Not given"],
                ...(advice ? [["What to ask for", advice, true] as [string, string, boolean]] : []),
                ...(r.status !== "to_contact" && r.status !== "contacted" ? [
                  ["How it ended", `${PAYMENT_STATUS_META[r.status].label}${r.closedByName ? `, ${r.closedByName}` : ""}${r.closedAt ? `, ${formatDateTime(new Date(r.closedAt))}` : ""}`, true] as [string, string, boolean],
                  ...(r.outcome ? [["Note", r.outcome, true] as [string, string, boolean]] : []),
                ] : []),
              ]} />
            </div>
          </RecordSection>
          {data.others.length ? (
            <RecordSection id="pay-others-h" title="Their other failed payments" aside={<p>{data.others.length}</p>}>
              <ul className="pc-list">
                {data.others.map((o) => (
                  <li key={o.id}>
                    <Link href={`/payments/${o.id}`} className="pc-row">
                      <span className="pc-row-body">
                        <span className="pc-row-title">{monthLabel(o.month)}</span>
                        <span className="pc-row-hint">{[o.siteName, o.returnReason || o.returnCode].filter(Boolean).join(" · ")}</span>
                        <span className="mt-2 flex flex-wrap gap-1.5"><Tag meta={PAYMENT_STATUS_META[o.status]} /></span>
                      </span>
                      <span className="pc-row-trail"><span className="pc-row-value tabular-nums">{euro(o.amountCents)}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </RecordSection>
          ) : null}
        </div>
        <div className="rec-side">
          <RecordSection id="pay-history-h" title="History">
            <RecordHistory items={data.history.map((h) => ({
              key: h.id, tone: historyTone(h.action),
              title: h.action === "contact" ? `${METHOD_LABEL[h.method as ContactMethod] ?? "Contacted"}: ${RESULT_LABEL[h.result as ContactResult]?.toLowerCase() ?? ""}` : PAYMENT_ACTIONS[h.action] ?? h.action,
              meta: `${h.actorName} · ${formatDateTime(new Date(h.createdAt))}`, note: h.action === "import" ? null : h.note,
            }))} />
          </RecordSection>
        </div>
      </div>
    </PageShell>
  );
}
