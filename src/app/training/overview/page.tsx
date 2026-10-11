import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleStart } from "@/components/workspace/module-start";
import { pageSession } from "@/lib/page-guards";
import { trainingAccess, trainingPages } from "@/modules/training/features/workspace";

export const metadata: Metadata = { title: "Training" };

/** Training's starter page. The layout has already checked Training access. */
export default async function TrainingStartPage() {
  const who = trainingAccess(await pageSession());
  if (!who) notFound();
  return <ModuleStart id="training" groups={[{ label: "", links: trainingPages(who) }]} />;
}
