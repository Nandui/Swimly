import "server-only";
import { registerDeskMeasures, registerHomeCard } from "@/modules/contributions";
import { coinageHomeItems } from "@/modules/finance-requests/features/coinage-queue/server/home";
import { refundHomeItems } from "@/modules/finance-requests/features/refund-queue/server/home";
import { refundsSent } from "@/modules/finance-requests/features/refund-queue/server/desk-measures";

/** Finance requests' registration plug (AGENTS.md, The app contract), loaded by
 *  src/modules/server.ts: one home card with what waits in refunds and coinage, and refund
 *  requests sent for the swim school's reception analytics. Its menu entry, levels and
 *  permissions are in manifest.ts. */
registerHomeCard({ moduleId: "finance-requests", items: async (viewer) => [...await refundHomeItems(viewer), ...await coinageHomeItems(viewer)] });
registerDeskMeasures({ id: "refunds.sent", app: "finance-requests", list: refundsSent });
