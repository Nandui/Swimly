import type { Metadata } from "next";
import { requireRotaActor, rotaPages } from "@/modules/rota/features/workspace";
import { ModuleStart } from "@/components/workspace/module-start";

export const metadata: Metadata = { title: "Rota" };

/** The rota's starter page: who is on today, the manager's quick actions, and
 *  the rota's pages. The layout has already checked rota access. */
export default async function RotaOverviewPage() {
  const who = await requireRotaActor();
  return <ModuleStart id="rota" groups={[{ label: "", links: rotaPages(who.run) }]} />;
}
