/** Courses: put one on, its sessions, candidates, pre-course checks,
 *  registers and results. Entry for the module and its routes. */
export {
  CandidateDialog, ChecksDialog, CourseDialog, CourseStatusButton, LinkCandidateButton, RegisterDialog, ResultDialog, SessionDialog, WithdrawButton,
} from "@/modules/academy/features/courses/components/forms";
export { academyCourse, academyHome, newCourseOptions, type CourseRow } from "@/modules/academy/features/courses/server/data";
export { ACADEMY_SESSIONS, academyHomeItems, academySessionCommitments } from "@/modules/academy/features/courses/server/contributions";
export {
  ACADEMY_CALL_DUE_META, ACADEMY_COURSE_META, ACADEMY_KIND_META, ACADEMY_PAYMENT_META, ACADEMY_RESULT_META, callDue, euro, hoursLabel,
  type AcademyKind, type AcademyPayment, type AcademyResult,
} from "@/modules/academy/shared/rules";
export { SWIMMER_RECORD_META } from "@/modules/academy/shared/rules";
