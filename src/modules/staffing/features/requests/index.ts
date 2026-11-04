/** Requests: swaps and exam absences, the page's reads and dialogs. */
export { requestsPage } from "@/modules/staffing/features/requests/server/data";
export { AcceptSwap, AskSwap, DecideSwap, RecordExam } from "@/modules/staffing/features/requests/components/request-dialogs";

// What its pages show, from the module's shared rules and screen kit.
export { shiftLabel } from "@/modules/staffing/shared/components/kit";
export { COLLEGE_META, EXAM_OUTCOME_META, REQUEST_FLAG_META, SEASON_LABEL, SWAP_STATUS_META } from "@/modules/staffing/shared/rules";
export type { College, SeasonName } from "@/modules/staffing/shared/rules";
