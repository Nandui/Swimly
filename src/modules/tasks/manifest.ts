import { ClipboardCheck } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry,
 *  levels and the permissions each level gives (docs/how-turnfin-works.md). Listed
 *  in src/app/modules.ts. Client-safe: menus and the role editor read it. */
// Tasks (owner request, 8 October 2026; docs/tasks.md): each site's daily
// checks and logs, from templates on a schedule.
export const tasksModule: ModuleManifest = {
  id: "tasks",
  group: "poolside",
  name: "Tasks",
  description: "Each site's daily checks and logs: checklists, readings with acceptable ranges, approval and follow-up actions",
  icon: ClipboardCheck,
  href: "/tasks",
  logName: "Tasks",
  access: {
    reach: "sites",
    levels: [
      { key: "do", label: "Do", help: "The day's tasks at their sites that are aimed at their role, and raising follow-up actions.", permissions: ["tasks.complete"] },
      { key: "review", label: "Review", help: "Also approve and reopen tasks, mark them not applicable, resolve actions and see the reports.", permissions: ["tasks.review"] },
      { key: "manage", label: "Manage", help: "Also write the task templates: what each asks for, where, for whom and when.", permissions: ["tasks.manage"] },
    ],
  },
};
