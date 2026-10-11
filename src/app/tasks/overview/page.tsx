import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleStart } from "@/components/workspace/module-start";
import { pageSession } from "@/lib/page-guards";
import { tasksAccess, tasksPages } from "@/modules/tasks/features/workspace";

export const metadata: Metadata = { title: "Tasks" };

/** Tasks' starter page. The layout has already checked Tasks access. */
export default async function TasksOverviewPage() {
  const who = tasksAccess(await pageSession());
  if (!who) notFound();
  return <ModuleStart id="tasks" groups={[{ label: "", links: tasksPages(who) }]} />;
}
