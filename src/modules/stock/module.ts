import "server-only";
import { registerHomeCard } from "@/modules/contributions";
import { stockHomeItems } from "@/modules/stock/features/counts";

/** Stock's registration plug (CLAUDE.md section 5), loaded by src/modules/server.ts: the home card.
 *  Its menu entry, levels and permissions are in manifest.ts. */
registerHomeCard({ moduleId: "stock", items: stockHomeItems });
