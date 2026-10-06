import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { AddRule, RemoveRule, SupplierDialog } from "@/components/purchasing/suppliers";
import { plural } from "@/lib/format";
import { suppliersPage } from "@/lib/purchasing/data";
import { APPROVAL_LIST_META, euro } from "@/lib/purchasing/rules";

export const metadata: Metadata = { title: "Suppliers" };

/** The approved suppliers, and who approves orders from any supplier without approvers of its own. */
export default async function SuppliersPage() {
  const { who, suppliers, rules, roles } = await suppliersPage();
  const general = rules.filter((r) => r.supplierId === null);
  const own = new Set(rules.filter((r) => r.supplierId).map((r) => r.supplierId));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Suppliers" description="Orders can only be raised with these suppliers, for their approved products." actions={who.manage ? <SupplierDialog /> : null} />

      <section aria-labelledby="sup-list" className="pc-panel">
        <div className="pc-panel-head"><h2 id="sup-list">Approved suppliers</h2></div>
        {suppliers.length === 0 ? (
          <EmptyState compact icon="building" title="No approved suppliers yet" hint={who.manage ? "Add one, then its approved products and who approves its orders." : "Whoever manages Purchasing adds them."} />
        ) : (
          <ul className="pc-rows">
            {suppliers.map((s) => (
              <li key={s.id}>
                <Link href={`/purchasing/suppliers/${s.id}`} className="pc-row">
                  <span className="pc-row-body">
                    <span className="pc-row-title">{s.name}</span>
                    <span className="pc-row-hint">{[plural(s._count.products, "approved product"), plural(s._count.orders, "order"), own.has(s.id) ? "its own approvers" : "general approvers", s.accountNumber ? `account ${s.accountNumber}` : null].filter(Boolean).join(" · ")}</span>
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

      <section aria-labelledby="sup-general" className="pc-panel">
        <div className="pc-panel-head">
          <div className="flex flex-col gap-1">
            <h2 id="sup-general">Approvers for every supplier</h2>
            <p className="pc-row-hint">Who may approve orders from a supplier that has no approvers of its own, and up to how much. Nobody approves their own order.</p>
          </div>
        </div>
        {general.length === 0 ? <EmptyState compact title="No general approvers yet" hint="Orders can only go to suppliers with approvers of their own." /> : (
          <ul className="pc-rows">
            {general.map((r) => (
              <li key={r.id} className="pc-row">
                <span className="pc-row-body"><span className="pc-row-title">{r.role.name}</span><span className="pc-row-hint">{r.limitCents === null ? "Any amount" : `Up to ${euro(r.limitCents)}`}</span></span>
                {who.manage ? <span className="pc-row-trail"><RemoveRule id={r.id} label={`${r.role.name} as an approver for every supplier`} /></span> : null}
              </li>
            ))}
          </ul>
        )}
        {who.manage ? <AddRule supplierId={null} roles={roles} /> : null}
      </section>
    </div>
  );
}
