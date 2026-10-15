import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/shadcn/button";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { EmailHistory, EmailPreview, lastSentToSupplier, orderEmailPage, SendTest, SendToSupplier } from "@/modules/purchasing/features/orders";

export const metadata: Metadata = { title: "Email purchase order" };

/** An approved order's email, exactly as the supplier will get it. Send yourself a test
 *  first; it goes to the supplier only once whoever manages Purchasing has turned emails
 *  to suppliers on (docs/purchasing.md). */
export default async function EmailOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { who, order: o, emailsOn, sender, preview, input, mayEmail } = await orderEmailPage((await params).id);
  if (!preview || !input) notFound();
  const supplierEmail = o.supplier.email.trim();
  const sentBefore = lastSentToSupplier(o.emails);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<span className="tabular-nums">Email {input.number}</span>} back={{ href: `/purchasing/${o.id}`, label: "The order" }}
        description={`To ${o.supplier.name}. Check the email, send yourself a test, then send it.`}
        actions={mayEmail ? <span className="flex flex-wrap gap-2">
          {sender.email ? <SendTest id={o.id} to={sender.email} /> : null}
          {emailsOn && supplierEmail ? <SendToSupplier id={o.id} number={input.number} supplier={o.supplier.name} to={supplierEmail} replyTo={sender.email} sentBefore={sentBefore} /> : null}
        </span> : null} />

      <div className="space-y-3">
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
        {!sender.email ? <Notice tone="warning" title="Your account has no email address" description="A test can't reach you, and the supplier's replies would have nowhere to go. Ask an administrator to add one." /> : null}
      </div>

      <section aria-labelledby="po-email" className="pc-panel flex flex-col gap-4">
        <div className="pc-panel-head"><h2 id="po-email">The email</h2></div>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-ui-muted-foreground">To</dt><dd className="font-medium break-words">{supplierEmail || "No address yet"}</dd>
          <dt className="text-ui-muted-foreground">Replies go to</dt><dd className="font-medium break-words">{sender.email ? `${sender.name}, ${sender.email}` : "Nobody: your account has no email address"}</dd>
          <dt className="text-ui-muted-foreground">Subject</dt><dd className="font-medium break-words">{preview.subject}</dd>
        </dl>
        <EmailPreview html={preview.html} title={`The email of ${input.number}`} />
      </section>

      <EmailHistory emails={o.emails} />
    </div>
  );
}
