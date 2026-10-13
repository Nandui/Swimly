import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { stockPages } from "@/modules/stock/features/workspace";

export const metadata: Metadata = { title: "Stock" };

/** Stock's starter page. The layout has already checked access. */
export default function StockOverviewPage() {
  return <ModuleStart id="stock" groups={[{ label: "", links: stockPages() }]} />;
}
