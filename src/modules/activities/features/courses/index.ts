/** Classes: browsing, adding and changing them, and one class's page. Entry for
 *  the module and its routes. */
export { ClassBrowser } from "@/modules/activities/features/courses/components/class-browser";
export { ClassDetailView } from "@/modules/activities/features/courses/components/class-detail";
export { type CourseInput, createCourse, updateCourse } from "@/modules/activities/features/courses/server/actions/courses";
export { classReturnHref } from "@/modules/activities/features/courses/server/browse";
export { getClassCover } from "@/modules/activities/shared/attendance/data/cover";
export { weekdayOfIso } from "@/modules/activities/shared/attendance/dates";
export { courseName } from "@/modules/activities/shared/courses/constants";
export { getCourse, getCourses, getInstructorOptions, getRoster } from "@/modules/activities/shared/courses/data/courses";
export { getLevelOptions } from "@/modules/activities/shared/curriculum/data/curriculum";
export { type EnrolInput, enrolStudent } from "@/modules/activities/shared/enrolment/actions/enrolment";
export { getTransferTargets } from "@/modules/activities/shared/enrolment/data/enrolments";
export { scheduleHref } from "@/modules/activities/shared/schedule/dates";
