import "server-only";
import { registerHomeCard } from "@/modules/contributions";
import { voucherHomeItems } from "@/modules/vouchers/features/redeem/server/contributions";

/** The Vouchers registration plug (AGENTS.md, The app contract), loaded by src/modules/server.ts:
 *  the home card. Its menu entry, levels and permissions are in manifest.ts. */
registerHomeCard({ moduleId: "vouchers", items: voucherHomeItems });
