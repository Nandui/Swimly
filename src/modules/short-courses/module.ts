import "server-only";
import { registerAreaRename, registerCommitments, registerAppCourses, registerEmailBookings, registerHomeCard, registerMemberHistory } from "@/modules/contributions";
import { parentsAppCourses } from "@/modules/short-courses/features/courses/server/parents-app";
import { shortCourseEmailBookings } from "@/modules/short-courses/features/courses/server/email-bookings";
import { renameShortCoursePlaces, SHORT_COURSE_SESSIONS, shortCourseCommitments, shortCourseHomeItems, shortCourseMemberHistory } from "@/modules/short-courses/features/courses/server/contributions";

/** Short courses' registration plug (AGENTS.md, The app contract), loaded by src/modules/server.ts:
 *  sessions as commitments (the Rota shows them), area renames, the home card, the courses each
 *  swimmer has been booked on for their profile, the Pool courses shown in the parents app, and
 *  places booked under an email for "My bookings" on the Academy booking site. Its menu entry, levels and permissions are in manifest.ts. */
registerCommitments({ id: SHORT_COURSE_SESSIONS, app: "short-courses", list: shortCourseCommitments });
registerAreaRename({ id: "short-courses.places", rename: renameShortCoursePlaces });
registerHomeCard({ moduleId: "short-courses", items: shortCourseHomeItems });
registerMemberHistory({ id: "short-courses.bookings", app: "short-courses", list: shortCourseMemberHistory });
registerAppCourses(parentsAppCourses);
registerEmailBookings({ id: "short-courses.bookings-by-email", app: "short-courses", list: shortCourseEmailBookings });
