import "server-only";
import { registerHomeCard } from "@/modules/contributions";
import { tasksHomeItems } from "@/modules/tasks/features/day/server/home";

/** Tasks' registration plug (AGENTS.md, The app contract), loaded by
 *  src/modules/server.ts. Its menu entry, levels and permissions are in manifest.ts. */
registerHomeCard({ moduleId: "tasks", items: tasksHomeItems });
