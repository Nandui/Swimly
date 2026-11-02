/** The Finance requests workspace: its frame, page list (for the bar and the starter page) and
 *  access checks. Entry for the module and its routes. */
export { FinanceShell } from "@/modules/finance-requests/features/workspace/components/shell";
export { financeActor } from "@/modules/finance-requests/shared/access";
export { financePages } from "@/modules/finance-requests/features/workspace/pages";
export { requireRefundActor } from "@/modules/finance-requests/shared/refunds/auth";
export { requireCoinageActor } from "@/modules/finance-requests/shared/coinage/auth";
