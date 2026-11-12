import "server-only";
import { registerHomeCard } from "@/modules/contributions";
import { purchasingHomeItems } from "@/modules/purchasing/features/orders/server/home";

/** Purchasing's registration plug (AGENTS.md, The app contract), loaded by
 *  src/modules/server.ts. Its menu entry, levels and permissions are in manifest.ts. */
registerHomeCard({ moduleId: "purchasing", items: purchasingHomeItems });
