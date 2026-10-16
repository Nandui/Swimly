import "server-only";
import { registerDeskMeasures, registerHomeCard } from "@/modules/contributions";
import { refundHomeItems, refundsSent } from "@/modules/refunds/features/queue";

/** Refunds' registration plug (CLAUDE.md section 5), loaded by
 *  src/modules/server.ts: the home card, and requests sent for the swim school's reception
 *  analytics. Its menu entry, levels and permissions are in manifest.ts. */
registerHomeCard({ moduleId: "refunds", items: refundHomeItems });
registerDeskMeasures({ id: "refunds.sent", list: refundsSent });
