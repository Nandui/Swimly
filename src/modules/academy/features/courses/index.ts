/** Courses: put one on, its sessions, candidates, pre-course checks,
 *  registers and results. Entry for the module and its routes. */
export {
  CandidateDialog, ChecksDialog, CourseDialog, CourseStatusButton, RegisterDialog, ResultDialog, SessionDialog, WithdrawButton,
  type CandidateEdit, type CourseEdit, type SessionEdit,
} from "@/modules/academy/features/courses/components/forms";
export { academyCourse, academyHome, newCourseOptions, type AcademyCourseView, type CourseRow } from "@/modules/academy/features/courses/server/data";
export { ACADEMY_SESSIONS, academyHomeItems, academySessionCommitments } from "@/modules/academy/features/courses/server/contributions";
export {
  ACADEMY_CALL_DUE_META, ACADEMY_COURSE_META, ACADEMY_KIND_META, ACADEMY_PAYMENT_META, ACADEMY_RESULT_META, callDue, euro, hoursLabel,
  type AcademyKind, type AcademyPayment, type AcademyResult,
} from "@/modules/academy/shared/rules";
