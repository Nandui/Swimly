/** Courses: put one on with its weekly sessions, book people on, keep the waiting list and
 *  take registers. Entry for the module and its routes. */
export {
  CourseDialog, CourseStatusButton, LinkPersonButton, PersonDialog, PlaceButton, RegisterDialog, SessionDialog,
} from "@/modules/activities/features/short-courses/components/forms";
export { shortCoursesAccess } from "@/modules/activities/shared/short-courses/access";
export { newCourseOptions, shortCourse, shortCoursesHome, type CourseRow, type ShortCourseView } from "@/modules/activities/features/short-courses/server/data";
export { renameShortCoursePlaces, SHORT_COURSE_SESSIONS, shortCourseCommitments, shortCourseHomeItems } from "@/modules/activities/features/short-courses/server/contributions";
export {
  clock, euro, HEALTH_FORM_META, SHORT_COURSE_AREA_META, SHORT_COURSE_CALL_DUE_META, SHORT_COURSE_META, SHORT_COURSE_ONLINE_META, SHORT_COURSE_PAYMENT_META, SHORT_COURSE_PLACE_META, SWIMMER_RECORD_META,
  type ShortCourseArea, type ShortCoursePayment,
} from "@/modules/activities/shared/short-courses/rules";
