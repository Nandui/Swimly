/** Strikes: the page's reads and the owner's dialogs. */
export { strikesPage } from "@/modules/staffing/features/strikes/server/data";
export { HandleStrike, WithdrawStrike } from "@/modules/staffing/features/strikes/components/strike-dialogs";

// What its pages show, from the module's shared rules and screen kit.
export { STRIKE_CAUSE_META, STRIKE_STAGE_META, semesterOf } from "@/modules/staffing/shared/rules";
export type { StrikeStage } from "@/modules/staffing/shared/rules";
