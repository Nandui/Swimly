/** Courses: put one on with its weekly sessions, book people on, keep the waiting list and
 *  take registers. Entry for the module and its routes. */
export {
  CourseDialog, CourseStatusButton, PersonDialog, PlaceButton, RegisterDialog, SessionDialog,
  type CourseEdit, type PersonEdit, type SessionEdit,
} from "@/modules/short-courses/features/courses/components/forms";
export { newCourseOptions, shortCourse, shortCoursesHome, type CourseRow, type ShortCourseView } from "@/modules/short-courses/features/courses/server/data";
export { renameShortCoursePlaces, SHORT_COURSE_SESSIONS, shortCourseCommitments, shortCourseHomeItems } from "@/modules/short-courses/features/courses/server/contributions";
export {
  clock, euro, HEALTH_FORM_META, SHORT_COURSE_AREA_META, SHORT_COURSE_CALL_DUE_META, SHORT_COURSE_META, SHORT_COURSE_ONLINE_META, SHORT_COURSE_PAYMENT_META, SHORT_COURSE_PLACE_META,
  type ShortCourseArea, type ShortCoursePayment,
} from "@/modules/short-courses/shared/rules";
