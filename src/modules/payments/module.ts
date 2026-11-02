import "server-only";
import { registerHomeCard, registerMemberNotices } from "@/modules/contributions";
import { memberPaymentNotices } from "@/modules/payments/features/failures/server/data";
import { paymentsHomeItems } from "@/modules/payments/features/failures/server/home";

/** Payments' registration plug (AGENTS.md, The app contract), loaded by src/modules/server.ts: the
 *  home card, and a "Payment failed" badge on the swimmer profile of anyone with a failure still
 *  open. Its menu entry, levels and permissions are in manifest.ts. */
registerHomeCard({ moduleId: "payments", items: paymentsHomeItems });
registerMemberNotices({ id: "payments.failed", app: "payments", list: memberPaymentNotices });
