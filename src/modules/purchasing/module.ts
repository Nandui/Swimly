import "server-only";
import { registerHomeCard } from "@/modules/contributions";
import { purchasingHomeItems } from "@/modules/purchasing/features/orders";

/** Purchasing's registration plug (CLAUDE.md section 5), loaded by
 *  src/modules/server.ts. Its menu entry, levels and permissions are still
 *  described in src/modules/registry.ts until the platform registry takes
 *  module plugs (ADR 0004). */
registerHomeCard({ moduleId: "purchasing", items: purchasingHomeItems });
