import type { Metadata } from "next";
import Link from "next/link";
import { Package, ReceiptText, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { AddRule, APPROVAL_LIST_META, euro, RemoveRule, SupplierDialog, SupplierEmailCopy, SupplierEmailsSwitch, SUPPLIER_EMAILS_META, SupplierMonogram, suppliersPage } from "@/modules/purchasing/features/suppliers";
import { formatDateTime, plural } from "@/lib/format";

export const metadata: Metadata = { title: "Suppliers" };

/** The approved suppliers as tiles, then who approves orders from any supplier without
 *  approvers of its own and the emails to suppliers, side by side. */
export default async function SuppliersPage() {
  const { who, suppliers, rules, roles, emails } = await suppliersPage();
  const general = rules.filter((r) => r.supplierId === null);
  const own = new Set(rules.filter((r) => r.supplierId).map((r) => r.supplierId));
  return (
    <PageShell className="po-desk" header={<PageHeader title="Suppliers" description="Orders can only be raised with these suppliers, for their approved products." actions={who.manage ? <SupplierDialog /> : null} />}>

      <section aria-labelledby="sup-list" className="po-card">
        <div className="po-card-head"><h2 id="sup-list">Approved suppliers{suppliers.length ? <span className="po-count">{suppliers.length}</span> : null}</h2></div>
        {suppliers.length === 0 ? (
          <EmptyState compact icon="building" title="No approved suppliers yet" hint={who.manage ? "Add one, then its approved products and who approves its orders." : "Whoever manages Purchasing adds them."} />
        ) : (
          <ul className="po-tiles">
            {suppliers.map((s) => (
              <li key={s.id}>
                <Link href={`/purchasing/suppliers/${s.id}`} className="po-tile" data-muted={s.archivedAt ? "" : undefined}>
                  <span className="po-tile-head">
                    <SupplierMonogram name={s.name} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="po-tile-name">{s.name}</span>
                      <span className="po-tile-sub">{s.accountNumber ? `Account ${s.accountNumber}` : s.contactName || s.email || "No account number"}</span>
                    </span>
                  </span>
                  <span className="po-tile-facts">
                    {s.archivedAt ? <Tag meta={APPROVAL_LIST_META.removed} /> : null}
                    <span className="po-chip"><Package aria-hidden="true" />{plural(s._count.products, "approved product")}</span>
                    <span className="po-chip"><ReceiptText aria-hidden="true" />{plural(s._count.orders, "order")}</span>
                    <span className="po-chip"><ShieldCheck aria-hidden="true" />{own.has(s.id) ? "Its own approvers" : "General approvers"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="po-pair">
        <section aria-labelledby="sup-general" className="po-card">
          <div className="po-card-head">
            <div>
              <h2 id="sup-general">Approvers for every supplier</h2>
              <p className="po-fine">Who may approve orders from a supplier that has no approvers of its own, and up to how much. Nobody approves their own order, except administrators.</p>
            </div>
          </div>
          {general.length === 0 ? <EmptyState compact title="No general approvers yet" hint="Orders can only go to suppliers with approvers of their own." /> : (
            <ul className="pc-rows">
              {general.map((r) => (
                <li key={r.id} className="pc-row">
                  <span className="po-mark" data-status="approved"><ShieldCheck aria-hidden="true" /></span>
                  <span className="pc-row-body"><span className="pc-row-title">{r.role.name}</span><span className="pc-row-hint po-rule-limit">{r.limitCents === null ? "Any amount" : `Up to ${euro(r.limitCents)}`}</span></span>
                  {who.manage ? <span className="pc-row-trail"><RemoveRule id={r.id} label={`${r.role.name} as an approver for every supplier`} /></span> : null}
                </li>
              ))}
            </ul>
          )}
          {who.manage ? <AddRule supplierId={null} roles={roles} /> : null}
        </section>

        <section id="supplier-emails" aria-labelledby="sup-emails" className="po-card">
          <div className="po-card-head">
            <div>
              <h2 id="sup-emails">Emails to suppliers</h2>
              <p className="po-fine">When it is on, an approved order can be emailed straight to its supplier from the order. While it is off, people can only send themselves a test.</p>
            </div>
          </div>
          <div className="po-switch" data-on={emails.on ? "" : undefined}>
            <div className="flex min-w-0 flex-col gap-1">
              <Tag meta={SUPPLIER_EMAILS_META[emails.on ? "on" : "off"]} />
              <p className="po-switch-word">{emails.on ? "Approved orders can be emailed to suppliers" : "Only tests to yourself"}</p>
              <p className="po-fine">{emails.changedByName && emails.changedAt ? `Last changed by ${emails.changedByName}, ${formatDateTime(emails.changedAt)}` : !emails.tested ? "Send yourself a test from an approved order first; it can be turned on after that." : "Never turned on yet."}</p>
            </div>
            {who.manage && (emails.on || emails.tested) ? <SupplierEmailsSwitch on={emails.on} /> : null}
          </div>
          <ul className="pc-rows">
            <li className="pc-row">
              <span className="pc-row-body">
                <span className="pc-row-title break-words">{emails.copyTo ? `Copy to ${emails.copyTo}` : "Nobody is copied"}</span>
                <span className="pc-row-hint">{emails.copyTo.includes(",") ? "Get" : "Gets"} a copy (CC) of every order emailed to a supplier, as does whoever raised the order. Tests are not copied.</span>
              </span>
              {who.manage ? <span className="pc-row-trail"><SupplierEmailCopy copyTo={emails.copyTo} /></span> : null}
            </li>
          </ul>
        </section>
      </div>
    </PageShell>
  );
}

