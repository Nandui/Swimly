import "server-only";
import { registerHomeCard } from "@/modules/contributions";
import { cctvHomeItems } from "@/modules/cctv/features/viewings/server/contributions";

/** The CCTV log's registration plug (CLAUDE.md section 5), loaded by src/modules/server.ts: the home card.
 *  Its menu entry, levels and permissions are in manifest.ts. */
registerHomeCard({ moduleId: "cctv", items: cctvHomeItems });
