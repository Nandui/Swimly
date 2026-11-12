import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { tasksAccess, tasksExport } from "@/modules/tasks/features/reports";

/** Everything Tasks keeps for the organisation as one JSON file (the prototype's "Export
 *  workspace"): sites' settings, templates, tasks with their comments and file names, actions and
 *  frozen scores. Manage only; the export itself is audited. */
export async function GET() {
  const session = await auth();
  const who = session?.user ? tasksAccess(session) : null;
  if (!who?.manage) return new Response("Not found", { status: 404 });
  const data = await tasksExport();
  await logAudit({ actorId: who.id, actorName: who.name, action: "export", entity: "TaskTemplate", entityId: "export", clubId: null,
    summary: `Exported Tasks: ${data.templates.length} templates, ${data.tasks.length} tasks, ${data.actions.length} actions` });
  return new Response(JSON.stringify(data, null, 2), { headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="turnfin-tasks-${data.exportedAt.slice(0, 10)}.json"`,
  } });
}
