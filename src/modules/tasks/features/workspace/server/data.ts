import "server-only";
import { prisma } from "@/lib/prisma";
import { tasksSites } from "@/modules/tasks/shared/data";

/** Open follow-up actions at each site this person does tasks at: the count in the page bar. */
export async function openActionCount() {
  const { sites } = await tasksSites();
  return prisma.taskAction.count({ where: { siteId: { in: sites.map((s) => s.id) }, status: "open" } });
}
