import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { coinagePages, requireCoinageActor } from "@/modules/coinage/features/workspace";

export const metadata: Metadata = { title: "Coinage" };

/** Coinage's starter page. The layout has already checked Coinage access. */
export default async function CoinageOverviewPage() {
  const who = await requireCoinageActor();
  return <ModuleStart id="coinage" groups={[{ label: "", links: coinagePages(who) }]} />;
}
