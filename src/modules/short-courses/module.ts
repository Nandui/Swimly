import "server-only";
import { registerAreaRename, registerCommitments, registerDeskMeasures, registerAppCourses, registerHomeCard, registerMemberHistory } from "@/modules/contributions";
import { parentsAppCourses } from "@/modules/short-courses/features/courses/server/parents-app";
import { academyCallBacks } from "@/modules/short-courses/features/academy-calls/server/desk-measures";
import { ACADEMY_SESSIONS, academyHomeItems, academyMemberHistory, academySessionCommitments } from "@/modules/short-courses/features/academy-courses/server/contributions";
import { renameShortCoursePlaces, SHORT_COURSE_SESSIONS, shortCourseCommitments, shortCourseHomeItems, shortCourseMemberHistory } from "@/modules/short-courses/features/courses/server/contributions";

/** Short courses' registration plug (AGENTS.md, The app contract), loaded by src/modules/server.ts:
 *  both kinds of course's sessions as commitments (the Rota shows them), area renames, the
 *  home card, the Academy's call backs for the swim school's reception analytics,, the courses
 *  each swimmer has been booked on for their profile, and the Pool courses shown in the parents app. Its menu entry, levels and permissions are in manifest.ts. */
registerCommitments({ id: SHORT_COURSE_SESSIONS, app: "short-courses", list: shortCourseCommitments });
registerCommitments({ id: ACADEMY_SESSIONS, app: "short-courses", list: academySessionCommitments });
registerAreaRename({ id: "short-courses.places", rename: renameShortCoursePlaces });
registerHomeCard({ moduleId: "short-courses", items: async (viewer) => [...await shortCourseHomeItems(viewer), ...await academyHomeItems(viewer)] });
registerDeskMeasures({ id: "short-courses.academy-calls", app: "short-courses", list: academyCallBacks });
registerMemberHistory({ id: "short-courses.bookings", app: "short-courses", list: shortCourseMemberHistory });
registerMemberHistory({ id: "short-courses.academy-candidates", app: "short-courses", list: academyMemberHistory });
registerAppCourses(parentsAppCourses);
