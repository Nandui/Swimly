import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/shadcn/button";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordFact, RecordFacts, RecordSection } from "@/components/ui-kit/record";
import { EmailHistory, EmailPreview, lastSentToSupplier, orderEmailPage, SendTest, SendToSupplier } from "@/modules/purchasing/features/orders";

export const metadata: Metadata = { title: "Email purchase order" };

/** An approved order's email, exactly as the supplier will get it. Send yourself a test
 *  first; it goes to the supplier only once whoever manages Purchasing has turned emails
 *  to suppliers on. */
export default async function EmailOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { who, order: o, emailsOn, supplierCopies, sender, replyTo, preview, input, mayEmail } = await orderEmailPage((await params).id);
  if (!preview || !input) notFound();
  const supplierEmail = o.supplier.email.trim();
  const sentBefore = lastSentToSupplier(o.emails);
  return (
    <PageShell spacing="roomy" header={<PageHeader title={<span className="tabular-nums">Email {input.number}</span>} back={{ href: `/purchasing/${o.id}`, label: "The order" }}
        description={`To ${o.supplier.name}. Check the email, send yourself a test, then send it.`}
        actions={mayEmail ? <span className="flex flex-wrap gap-2">
          {sender.email ? <SendTest id={o.id} to={sender.email} /> : null}
          {emailsOn && supplierEmail ? <SendToSupplier id={o.id} number={input.number} supplier={o.supplier.name} to={supplierEmail} copyTo={supplierCopies.filter((a) => a.toLowerCase() !== supplierEmail.toLowerCase()).join(", ")} replyTo={replyTo.email} sentBefore={sentBefore} /> : null}
        </span> : null} />}>

      <div className="space-y-3 empty:hidden">
        {!mayEmail ? <Notice title="You can't email this order" description="Whoever raised it, anyone who raises orders at its site, or whoever manages Purchasing can." /> : null}
        {!emailsOn ? (
          <Notice tone="warning" title="Emails to suppliers are off"
            description={who.manage ? "Only tests to yourself can be sent. When a test looks right, turn emails to suppliers on under Suppliers." : "Only tests to yourself can be sent until whoever manages Purchasing turns emails to suppliers on."}
            actions={who.manage ? <Button asChild variant="outline" className="min-h-11"><Link href="/purchasing/suppliers#supplier-emails">Go to Suppliers</Link></Button> : null} />
        ) : null}
        {!supplierEmail ? (
          <Notice tone="warning" title={`${o.supplier.name} has no email address`}
            description={who.manage ? "Add it on the supplier's page." : "Whoever manages Purchasing adds it on the supplier's page."}
            actions={who.manage ? <Button asChild variant="outline" className="min-h-11"><Link href={`/purchasing/suppliers/${o.supplierId}`}>Open the supplier</Link></Button> : null} />
        ) : null}
        {!sender.email ? <Notice tone="warning" title="Your account has no email address" description={replyTo.email ? "A test can't reach you. Ask an administrator to add one." : "A test can't reach you, and the supplier's replies would have nowhere to go. Ask an administrator to add one."} /> : null}
      </div>

      <RecordSection id="po-email" title="The email" note="Exactly as it arrives.">
        <div className="rec-card">
          <RecordFacts>
            <RecordFact label="To">{supplierEmail || "No address yet"}</RecordFact>
            <RecordFact label="Copy to">{supplierCopies.join(", ") || "Nobody"}<span className="font-normal text-ui-muted-foreground"> (not on tests)</span></RecordFact>
            <RecordFact label="Replies go to">{replyTo.email ? `${replyTo.name}, ${replyTo.email}` : "Nobody: no email address for whoever raised the order or for you"}{replyTo.email && replyTo.email !== sender.email ? <span className="font-normal text-ui-muted-foreground"> (raised the order)</span> : null}</RecordFact>
            <RecordFact label="Subject">{preview.subject}</RecordFact>
          </RecordFacts>
          <div className="overflow-hidden rounded-card bg-(--fill-2)">
            <EmailPreview html={preview.html} title={`The email of ${input.number}`} />
          </div>
        </div>
      </RecordSection>

      <EmailHistory emails={o.emails} />
    </PageShell>
  );
}
