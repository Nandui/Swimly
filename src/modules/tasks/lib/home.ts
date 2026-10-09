import "server-only";
import { tasksHome } from "@/modules/tasks/lib/data";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard, type HomeItem } from "@/modules/contributions";

/** Tasks on the home page: today's tasks at their sites that are theirs to do, what is
 *  overdue, what waits for their approval and the open follow-ups; for reviewers, the
 *  completions their templates ask to tell them about. Counts only. */
registerHomeCard({
  moduleId: "tasks",
  async items(viewer) {
    const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
    if (!held.has("tasks.complete")) return [];
    const { todo, overdue, approval, completed, withExceptions, openActions } = await tasksHome();
    const items: HomeItem[] = [
      { label: "Tasks to do today", hint: "At your sites", href: "/tasks", count: todo, attention: false },
    ];
    if (overdue) items.push({ label: "Overdue tasks", href: "/tasks", count: overdue, attention: true });
    if (held.has("tasks.review") && approval) items.push({ label: "Tasks to approve", href: "/tasks", count: approval, attention: true });
    // Templates that ask to tell reviewers (Manage tasks, Report).
    if (held.has("tasks.review") && withExceptions) items.push({ label: "Completed with readings out of range", hint: "Today", href: "/tasks/reports?tab=tasks&status=exceptions", count: withExceptions, attention: true });
    if (held.has("tasks.review") && completed) items.push({ label: "Tasks completed today", href: "/tasks", count: completed, attention: false });
    if (openActions) items.push({ label: "Open follow-up actions", href: "/tasks/actions", count: openActions, attention: openActions > 0 });
    return items;
  },
});
