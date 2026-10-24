import "server-only";
import { registerHomeCard } from "@/modules/contributions";
import { hrHomeItems } from "@/modules/hr/features/details-requests/server/home";

/** HR's registration plug (AGENTS.md, The app contract), loaded by
 *  src/modules/server.ts. Its menu entry, levels and permissions are in manifest.ts. */
registerHomeCard({ moduleId: "hr", items: hrHomeItems });
