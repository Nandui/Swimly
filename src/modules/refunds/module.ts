import "server-only";
import { registerDeskMeasures, registerHomeCard } from "@/modules/contributions";
import { refundHomeItems } from "@/modules/refunds/features/queue/server/home";
import { refundsSent } from "@/modules/refunds/features/queue/server/desk-measures";

/** Refunds' registration plug (AGENTS.md, The app contract), loaded by
 *  src/modules/server.ts: the home card, and requests sent for the swim school's reception
 *  analytics. Its menu entry, levels and permissions are in manifest.ts. */
registerHomeCard({ moduleId: "refunds", items: refundHomeItems });
registerDeskMeasures({ id: "refunds.sent", app: "refunds", list: refundsSent });
