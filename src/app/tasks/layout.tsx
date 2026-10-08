import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { TasksShell } from "@/components/tasks/shell";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import { tasksAccess } from "@/lib/tasks/access";
import { tasksSites } from "@/lib/tasks/data";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Tasks", template: TITLE_TEMPLATE } };

/** The Tasks workspace: opens for the Tasks screen with `tasks.complete` at any scope;
 *  every page limits tasks to the sites that grant covers. */
export default async function TasksLayout({ children }: { children: ReactNode }) {
  const who = tasksAccess(await pageSession());
  if (!who) notFound();
  const { sites, home } = await tasksSites();
  return <TasksShell who={who} sites={sites.map(({ id, name }) => ({ id, name }))} home={home}>{children}</TasksShell>;
}
