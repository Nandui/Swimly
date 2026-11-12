import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { AddRule, APPROVAL_LIST_META, euro, RemoveRule, SupplierDialog, SupplierEmailCopy, SupplierEmailsSwitch, SUPPLIER_EMAILS_META, SupplierPicture, suppliersPage } from "@/modules/purchasing/features/suppliers";
import { formatDateTime, plural } from "@/lib/format";

export const metadata: Metadata = { title: "Suppliers" };

/** The approved suppliers as a grouped list, then who approves orders from any supplier without
 *  approvers of its own and the emails to suppliers, side by side. */
export default async function SuppliersPage() {
  const { who, suppliers, rules, roles, emails } = await suppliersPage();
  const general = rules.filter((r) => r.supplierId === null);
  const own = new Set(rules.filter((r) => r.supplierId).map((r) => r.supplierId));
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Suppliers" description="Orders can only be raised with these suppliers, for their approved products." actions={who.manage ? <SupplierDialog /> : null} />}>

      <section aria-labelledby="sup-list" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="sup-list">Approved suppliers</h2>{suppliers.length ? <p>{suppliers.length}</p> : null}</div>
        {suppliers.length === 0 ? (
          <EmptyState icon="building" title="No approved suppliers yet" hint={who.manage ? "Add one, then its approved products and who approves its orders." : "Whoever manages Purchasing adds them."} />
        ) : (
          <ul className="pc-list">
            {suppliers.map((s) => (
              <li key={s.id}>
                <Link href={`/purchasing/suppliers/${s.id}`} className="pc-row" data-muted={s.archivedAt ? "" : undefined}>
                  <SupplierPicture id={s.id} name={s.name} version={s.pictureVersion} />
                  <span className="pc-row-body">
                    <span className="pc-row-title">{s.name}</span>
                    <span className="pc-row-hint">{[s.accountNumber ? `Account ${s.accountNumber}` : s.contactName || s.email || "No account number",
                      plural(s._count.products, "approved product"), plural(s._count.orders, "order"), own.has(s.id) ? "its own approvers" : "general approvers"].join(" · ")}</span>
                  </span>
                  <span className="pc-row-trail">
                    {s.archivedAt ? <Tag meta={APPROVAL_LIST_META.removed} /> : null}
                    <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid items-start gap-(--space-7) lg:grid-cols-2">
        <section aria-labelledby="sup-general" className="flex min-w-0 flex-col">
          <div className="pc-section-head"><h2 id="sup-general">Approvers for every supplier</h2></div>
          <p className="pc-section-note">Who may approve orders from a supplier that has no approvers of its own, and up to how much. Nobody approves their own order, except administrators.</p>
          <div className="rec-card">
          {general.length === 0 ? <p className="text-sm text-ui-muted-foreground">No general approvers yet. Orders can only go to suppliers with approvers of their own.</p> : (
            <ul className="pc-rows">
              {general.map((r) => (
                <li key={r.id} className="pc-row">
                  <span className="pc-tile-icon" data-tone="green" aria-hidden="true"><ShieldCheck /></span>
                  <span className="pc-row-body"><span className="pc-row-title">{r.role.name}</span><span className="pc-row-hint tabular-nums">{r.limitCents === null ? "Any amount" : `Up to ${euro(r.limitCents)}`}</span></span>
                  {who.manage ? <span className="pc-row-trail"><RemoveRule id={r.id} label={`${r.role.name} as an approver for every supplier`} /></span> : null}
                </li>
              ))}
            </ul>
          )}
          {who.manage ? <AddRule supplierId={null} roles={roles} /> : null}
          </div>
        </section>

        <section id="supplier-emails" aria-labelledby="sup-emails" className="flex min-w-0 scroll-mt-6 flex-col">
          <div className="pc-section-head"><h2 id="sup-emails">Emails to suppliers</h2><Tag meta={SUPPLIER_EMAILS_META[emails.on ? "on" : "off"]} /></div>
          <p className="pc-section-note">When it is on, an approved order can be emailed straight to its supplier from the order. While it is off, people can only send themselves a test.</p>
          <div className="rec-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-semibold">{emails.on ? "Approved orders can be emailed to suppliers" : "Only tests to yourself"}</p>
              <p className="text-sm text-ui-muted-foreground">{emails.changedByName && emails.changedAt ? `Last changed by ${emails.changedByName}, ${formatDateTime(emails.changedAt)}` : !emails.tested ? "Send yourself a test from an approved order first; it can be turned on after that." : "Never turned on yet."}</p>
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
          </div>
        </section>
      </div>
    </PageShell>
  );
}

