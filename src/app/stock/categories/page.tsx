import type { Metadata } from "next";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { plural } from "@/lib/format";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import { ArchiveCategory, CategoryDialog, CategoryTag, stockCategories } from "@/modules/stock/features/products";

export const metadata: Metadata = { title: "Stock categories" };

/** The categories: how products are grouped on the count sheet, in this order. */
export default async function StockCategoriesPage() {
  const { who, categories } = await stockCategories();
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Categories" description="How products are grouped on the count sheet, in this order." actions={who.manage ? <CategoryDialog /> : undefined} />}>
      <section className="pc-panel" aria-label="Categories">
        {categories.length === 0 ? <EmptyState compact icon="layers" title="No categories yet" hint={who.manage ? "Add the first, such as Retail or Drink." : "Whoever manages Stock adds them."} /> : (
          <ul className="pc-rows">
            {categories.map((c) => (
              <li key={c.id} className="pc-row" {...(c.archivedAt ? { "data-muted": "" } : {})}>
                <span className="pc-row-body">
                  <span className="pc-row-title">{c.name}</span>
                  <span className="pc-row-hint">{plural(c._count.products, "product")}</span>
                </span>
                <span className="pc-row-trail">
                  {c.archivedAt ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : <CategoryTag name={c.name} tone={c.tone} />}
                  {who.manage ? <>
                    <CategoryDialog category={c} />
                    <ArchiveCategory id={c.id} name={c.name} archived={!!c.archivedAt} />
                  </> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
