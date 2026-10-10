import "server-only";
import { registerHomeCard } from "@/modules/contributions";
import { refundHomeItems } from "@/modules/refunds/features/queue";

/** Refunds' registration plug (CLAUDE.md section 5), loaded by
 *  src/modules/server.ts. Its menu entry, levels and permissions are still
 *  described in src/modules/registry.ts until the platform registry takes
 *  module plugs (ADR 0004). */
registerHomeCard({ moduleId: "refunds", items: refundHomeItems });
