import "server-only";
import { registerAreaRename, registerCommitments, registerHomeCard, registerPublicCourses } from "@/modules/contributions";
import { shortCoursePublicCourses } from "@/modules/short-courses/features/booking";
import { renameShortCoursePlaces, SHORT_COURSE_SESSIONS, shortCourseCommitments, shortCourseHomeItems } from "@/modules/short-courses/features/courses";

/** Short courses' registration plug (CLAUDE.md section 5), loaded by src/modules/server.ts:
 *  course sessions as commitments (the Rota shows them), area renames and the home card. Its
 *  menu entry, levels and permissions are in manifest.ts. Its courses open online go on the public
 *  booking site. */
registerCommitments({ id: SHORT_COURSE_SESSIONS, list: shortCourseCommitments });
registerAreaRename({ id: "short-courses.places", rename: renameShortCoursePlaces });
registerHomeCard({ moduleId: "short-courses", items: shortCourseHomeItems });
registerPublicCourses(shortCoursePublicCourses);
