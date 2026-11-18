/** Plan (test)'s public API (AGENTS.md, How apps talk): the only file other modules, Core and front may
 *  import. Turnfin Me's staff API reads and saves a person's own usual week through it (D34); no
 *  other app asks Plan anything while it is on test. The tag maps are here for Core's tone check. */
export { OFF_REASON_META } from "@/modules/plan/shared/rules";
export { myUsualWeek, saveMyUsualWeek } from "@/modules/plan/features/availability";
