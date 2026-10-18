/** Courses: put one on, its sessions, candidates, pre-course checks,
 *  registers and results. Entry for the module and its routes. */
export {
  CandidateDialog, ChecksDialog, CourseDialog, CourseStatusButton, RegisterDialog, ResultDialog, SessionDialog, WithdrawButton,
} from "@/modules/short-courses/features/academy-courses/components/forms";
export { academyCourse, academyHome, newCourseOptions, type CourseRow } from "@/modules/short-courses/features/academy-courses/server/data";
export { ACADEMY_SESSIONS, academyHomeItems, academySessionCommitments } from "@/modules/short-courses/features/academy-courses/server/contributions";
export {
  ACADEMY_CALL_DUE_META, ACADEMY_COURSE_META, ACADEMY_KIND_META, ACADEMY_PAYMENT_META, ACADEMY_RESULT_META, callDue, euro, hoursLabel,
  type AcademyKind, type AcademyPayment, type AcademyResult,
} from "@/modules/short-courses/shared/academy-rules";
