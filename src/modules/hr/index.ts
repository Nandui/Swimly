/** HR's public API (CLAUDE.md section 6): the only file other modules, Core
 *  and front may import. Turnfin Me's staff API reads what HR has shared with
 *  a person through it. */
export { acknowledgeReviewFor, logOwnHrRead, mySharedHr } from "@/modules/hr/features/me";
export { hrConfigured } from "@/modules/hr/shared/database";
