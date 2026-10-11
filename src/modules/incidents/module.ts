import "server-only";
import { registerHomeCard } from "@/modules/contributions";
import { incidentHomeItems } from "@/modules/incidents/features/reports";

/** Incidents' registration plug (CLAUDE.md section 5), loaded by
 *  src/modules/server.ts. Its menu entry, levels and permissions are in manifest.ts. */
registerHomeCard({ moduleId: "incidents", items: incidentHomeItems });
