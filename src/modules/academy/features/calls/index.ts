/** Phoning people who held a place online, to take payment. Entry for the
 *  module and its routes. */
export { CallDialog } from "@/modules/academy/features/calls/components/forms";
export { toCall } from "@/modules/academy/features/calls/server/data";
export { ACADEMY_CALL_DUE_META, ACADEMY_CALL_META, ACADEMY_CALL_TIMES, type AcademyCallOutcome, type AcademyCallTime } from "@/modules/academy/shared/rules";
export { academyCallBacks } from "@/modules/academy/features/calls/server/desk-measures";
