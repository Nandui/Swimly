import "server-only";
import { tasksHome } from "@/lib/tasks/data";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard, type HomeItem } from "@/modules/contributions";

/** Tasks on the home page: today's tasks at their sites that are theirs to do, what is
 *  overdue, what waits for their approval and the open follow-ups. Counts only. */
registerHomeCard({
  moduleId: "tasks",
  async items(viewer) {
    const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
    if (!held.has("tasks.complete")) return [];
    const { todo, overdue, approval, openActions } = await tasksHome();
    const items: HomeItem[] = [
      { label: "Tasks to do today", hint: "At your sites", href: "/tasks", count: todo, attention: false },
    ];
    if (overdue) items.push({ label: "Overdue tasks", href: "/tasks", count: overdue, attention: true });
    if (held.has("tasks.review") && approval) items.push({ label: "Tasks to approve", href: "/tasks", count: approval, attention: true });
    if (openActions) items.push({ label: "Open follow-up actions", href: "/tasks/actions", count: openActions, attention: openActions > 0 });
    return items;
  },
});
