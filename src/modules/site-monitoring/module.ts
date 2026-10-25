import "server-only";
import { on } from "@/platform/events";
import { registerHomeCard } from "@/modules/contributions";
import { monitoringHomeItems } from "@/modules/site-monitoring/features/actions/server/home";
import { raiseFromTaskReadings } from "@/modules/site-monitoring/features/actions/server/raise";

/** Site Monitoring's registration plug (AGENTS.md, The app contract), loaded by src/modules/server.ts: the
 *  home card, and the event that raises its actions. Its menu entry, levels and permissions are in
 *  manifest.ts. A module reloaded in development stops its old listener first, so it never listens twice. */
const plug = globalThis as { siteMonitoringStop?: () => void };
registerHomeCard({ moduleId: "site-monitoring", items: monitoringHomeItems });
plug.siteMonitoringStop?.();
plug.siteMonitoringStop = on("tasks.reading.out_of_range", async (event) => { await raiseFromTaskReadings(event); });
