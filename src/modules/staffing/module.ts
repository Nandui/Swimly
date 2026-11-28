import "server-only";
import { registerHomeCard } from "@/modules/contributions";
import { staffingHomeItems } from "@/modules/staffing/features/workspace/server-home";

/** Staffing's plug, loaded by src/modules/server.ts: its
 *  home card. Its menu entry, levels and permissions are in manifest.ts. */
registerHomeCard({ moduleId: "staffing", items: staffingHomeItems });
